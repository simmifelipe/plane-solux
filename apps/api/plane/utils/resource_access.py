# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Central access rules for restricted modules and issues.

Rules (``is_restricted`` is opt-in, so existing data keeps today's behaviour):

* Project admins (and workspace admins who are project members) always have
  full access.
* A restricted **module** is governed only by its ``ResourceAccess`` grants,
  plus its creator (view).
* A restricted **issue** is governed only by its own grants. They *replace*
  any module grants. The issue's creator and assignees can always view it.
* An unrestricted issue that sits in one or more restricted modules is governed
  by those modules: the user needs a grant on **any** of them (union). Unrestricted
  modules never widen access. Creator and assignees can always view it.
* Everything else falls through to the normal project role checks, which are
  not handled here.

``comment`` and ``edit`` imply ``view``. Creator/assignee only ever grant
``view``; commenting and editing still need a grant.
"""

# Python imports
import threading
from contextlib import contextmanager
from enum import Enum

# Third party imports
from crum import get_current_user

# Django imports
from django.db.models import BooleanField, Exists, ExpressionWrapper, OuterRef, Q

# Module imports
from plane.db.models import (
    Issue,
    IssueAssignee,
    Module,
    ModuleIssue,
    ProjectMember,
    ResourceAccess,
    WorkspaceMember,
)

ADMIN_ROLE = 20


class AccessAction(str, Enum):
    VIEW = "view"
    COMMENT = "comment"
    EDIT = "edit"


_ACTION_FIELD = {
    AccessAction.VIEW: "can_view",
    AccessAction.COMMENT: "can_comment",
    AccessAction.EDIT: "can_edit",
}


def _is_authenticated(user):
    return user is not None and getattr(user, "is_authenticated", False)


def admin_project_ids(user):
    """Subquery of project ids where the user has admin power."""
    return ProjectMember.objects.filter(
        Q(role=ADMIN_ROLE)
        | Q(
            workspace_id__in=WorkspaceMember.objects.filter(member=user, role=ADMIN_ROLE, is_active=True).values(
                "workspace_id"
            )
        ),
        member=user,
        is_active=True,
    ).values("project_id")


def module_access_q(user, action=AccessAction.VIEW):
    """Q object selecting the modules ``user`` may access with ``action``."""
    if not _is_authenticated(user):
        return Q(is_restricted=False)

    granted_ids = ResourceAccess.objects.filter(
        user=user, module__isnull=False, **{_ACTION_FIELD[action]: True}
    ).values("module_id")

    q = Q(is_restricted=False) | Q(project_id__in=admin_project_ids(user)) | Q(pk__in=granted_ids)
    if action == AccessAction.VIEW:
        q |= Q(created_by=user)
    return q


def issue_access_q(user, action=AccessAction.VIEW):
    """Q object selecting the issues ``user`` may access with ``action``.

    Meant for querysets of ``Issue``. For related models filter with
    ``issue_id__in=accessible_issue_ids(...)`` instead.
    """
    if not _is_authenticated(user):
        return Q(is_restricted=False) & ~Exists(
            ModuleIssue.objects.filter(
                issue=OuterRef("pk"),
                module__is_restricted=True,
                module__deleted_at__isnull=True,
            )
        )

    field = _ACTION_FIELD[action]

    restricted_modules = ModuleIssue.objects.filter(
        issue=OuterRef("pk"),
        module__is_restricted=True,
        module__deleted_at__isnull=True,
    )
    module_grant = restricted_modules.filter(
        module__access_grants__user=user,
        module__access_grants__deleted_at__isnull=True,
        **{f"module__access_grants__{field}": True},
    )
    issue_grant = ResourceAccess.objects.filter(issue=OuterRef("pk"), user=user, **{field: True})

    unrestricted_ok = Q(is_restricted=False) & (~Exists(restricted_modules) | Exists(module_grant))
    restricted_ok = Q(is_restricted=True) & Exists(issue_grant)

    q = Q(project_id__in=admin_project_ids(user)) | unrestricted_ok | restricted_ok

    if action == AccessAction.VIEW:
        is_assignee = Exists(IssueAssignee.objects.filter(issue=OuterRef("pk"), assignee=user))
        q |= Q(created_by=user) | is_assignee
    return q


def accessible_modules(queryset, user, action=AccessAction.VIEW):
    """Restrict a ``Module`` queryset to what ``user`` may access."""
    return queryset.filter(module_access_q(user, action))


def accessible_issues(queryset, user, action=AccessAction.VIEW):
    """Restrict an ``Issue`` queryset to what ``user`` may access."""
    return queryset.filter(issue_access_q(user, action))


def accessible_issue_ids(user, action=AccessAction.VIEW):
    """Subquery of issue ids ``user`` may access, for filtering related models."""
    return accessible_issues(Issue.objects.all(), user, action).values("id")


def accessible_notifications(queryset, user):
    """Drop notifications about work items ``user`` can no longer see.

    A user who loses access (or never had it) must not keep reading titles and
    activity of a restricted work item through their notification inbox.
    """
    return queryset.filter(~Q(entity_name="issue") | Q(entity_identifier__in=accessible_issue_ids(user))).filter(
        # Solar: module ("Demanda") comment notifications follow restricted module access
        ~Q(entity_name="module")
        | Q(entity_identifier__in=accessible_modules(Module.objects.all(), user).values("id"))
    )


def can_access_module(user, module_id, action=AccessAction.VIEW):
    return accessible_modules(Module.objects.filter(pk=module_id), user, action).exists()


def can_access_issue(user, issue_id, action=AccessAction.VIEW):
    return accessible_issues(Issue.objects.filter(pk=issue_id), user, action).exists()


def annotate_module_access(queryset, user):
    """Add ``can_comment`` / ``can_edit`` booleans so the UI can hide actions.

    Queryset must already be restricted to viewable modules (see ``accessible_modules``).
    """
    return queryset.annotate(
        can_comment=ExpressionWrapper(module_access_q(user, AccessAction.COMMENT), output_field=BooleanField()),
        can_edit=ExpressionWrapper(module_access_q(user, AccessAction.EDIT), output_field=BooleanField()),
    )


def is_project_admin(user, project_id):
    return _is_authenticated(user) and admin_project_ids(user).filter(project_id=project_id).exists()


def effective_access(user, kind, resource_id, project_id):
    """What ``user`` may do with one module/issue, or ``None`` when it is not visible.

    ``kind`` is ``"module"`` or ``"issue"``. ``can_manage_access`` tells the UI
    whether to show the access panel (project admins only).
    """
    check = can_access_module if kind == "module" else can_access_issue
    if not check(user, resource_id, AccessAction.VIEW):
        return None
    return {
        "can_view": True,
        "can_comment": check(user, resource_id, AccessAction.COMMENT),
        "can_edit": check(user, resource_id, AccessAction.EDIT),
        "can_manage_access": is_project_admin(user, project_id),
    }


_state = threading.local()


@contextmanager
def unrestricted_access():
    """Disable the automatic per-user issue filtering inside the block.

    For system work running inside a request that must see every issue, e.g.
    moving all issues of a cycle regardless of who triggered it. Never wrap code
    whose result is returned to the user.
    """
    previous = getattr(_state, "bypass", False)
    _state.bypass = True
    try:
        yield
    finally:
        _state.bypass = previous


def restrict_to_request_user(queryset):
    """Apply the view rule for the user of the current request, if any.

    Called by ``Issue.issue_objects``. Code with no request (Celery tasks,
    management commands) gets the queryset untouched. An anonymous request gets
    only what is not restricted, so public boards never expose restricted issues.
    """
    if getattr(_state, "bypass", False):
        return queryset
    user = get_current_user()
    if user is None:
        return queryset
    return accessible_issues(queryset, user)
