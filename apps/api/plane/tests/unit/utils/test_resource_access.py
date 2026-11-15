# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, transaction

from plane.db.models import (
    Issue,
    IssueAssignee,
    Module,
    ModuleIssue,
    ProjectMember,
    ResourceAccess,
    WorkspaceMember,
)
from plane.tests.factories import ProjectFactory, UserFactory, WorkspaceFactory
from plane.utils.resource_access import (
    AccessAction,
    accessible_issue_ids,
    accessible_issues,
    accessible_modules,
    can_access_issue,
    can_access_module,
)

VIEW, COMMENT, EDIT = AccessAction.VIEW, AccessAction.COMMENT, AccessAction.EDIT


def make_issue(project, name, creator=None, **kwargs):
    issue = Issue(project=project, name=name, **kwargs)
    issue.save(created_by_id=creator.id if creator else None)
    return issue


def make_module(project, name, creator=None, **kwargs):
    module = Module(project=project, name=name, **kwargs)
    module.save(created_by_id=creator.id if creator else None)
    return module


def put_in_module(issue, module):
    ModuleIssue.objects.create(issue=issue, module=module, project=issue.project)


def grant(user, *, module=None, issue=None, view=True, comment=False, edit=False):
    return ResourceAccess.objects.create(
        project=(module or issue).project,
        module=module,
        issue=issue,
        user=user,
        can_view=view,
        can_comment=comment,
        can_edit=edit,
    )


@pytest.fixture
def ctx(db):
    workspace = WorkspaceFactory()
    project = ProjectFactory(workspace=workspace)

    def member(role=15):
        user = UserFactory()
        WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
        ProjectMember.objects.create(project=project, workspace=workspace, member=user, role=role)
        return user

    class Ctx:
        pass

    c = Ctx()
    c.workspace, c.project, c.member = workspace, project, member
    c.admin = member(role=20)
    c.alice = member()
    c.bob = member()
    return c


@pytest.mark.unit
class TestUnrestricted:
    """Nothing changes for data that was never restricted."""

    def test_everyone_sees_unrestricted_issue_and_module(self, ctx):
        module = make_module(ctx.project, "M")
        issue = make_issue(ctx.project, "I")
        put_in_module(issue, module)

        for user in (ctx.admin, ctx.alice, ctx.bob):
            assert can_access_issue(user, issue.id)
            assert can_access_module(user, module.id)

    def test_anonymous_sees_only_unrestricted_outside_restricted_modules(self, ctx):
        open_issue = make_issue(ctx.project, "open")
        hidden_by_module = make_issue(ctx.project, "in-restricted-module")
        restricted_issue = make_issue(ctx.project, "restricted", is_restricted=True)
        module = make_module(ctx.project, "R", is_restricted=True)
        put_in_module(hidden_by_module, module)

        visible = set(accessible_issues(Issue.objects.all(), AnonymousUser()).values_list("id", flat=True))
        assert visible == {open_issue.id}
        assert restricted_issue.id not in visible
        assert not can_access_module(AnonymousUser(), module.id)


@pytest.mark.unit
class TestRestrictedModule:
    def test_module_hidden_without_grant_visible_with_grant(self, ctx):
        module = make_module(ctx.project, "R", is_restricted=True)
        grant(ctx.alice, module=module)

        assert can_access_module(ctx.alice, module.id)
        assert not can_access_module(ctx.bob, module.id)

    def test_admin_and_creator_always_see_module(self, ctx):
        module = make_module(ctx.project, "R", creator=ctx.bob, is_restricted=True)

        assert can_access_module(ctx.admin, module.id, EDIT)
        assert can_access_module(ctx.bob, module.id)  # creator
        assert not can_access_module(ctx.alice, module.id)

    def test_workspace_admin_who_is_project_member_sees_everything(self, ctx):
        module = make_module(ctx.project, "R", is_restricted=True)
        ws_admin = ctx.member(role=15)
        WorkspaceMember.objects.filter(member=ws_admin).update(role=20)

        assert can_access_module(ws_admin, module.id, EDIT)

    def test_restricted_module_hides_its_unrestricted_issues(self, ctx):
        module = make_module(ctx.project, "R", is_restricted=True)
        issue = make_issue(ctx.project, "I")
        put_in_module(issue, module)
        grant(ctx.alice, module=module)

        assert can_access_issue(ctx.alice, issue.id)
        assert not can_access_issue(ctx.bob, issue.id)
        assert can_access_issue(ctx.admin, issue.id, EDIT)

    def test_grant_on_another_module_does_not_leak(self, ctx):
        module_a = make_module(ctx.project, "A", is_restricted=True)
        module_b = make_module(ctx.project, "B", is_restricted=True)
        issue = make_issue(ctx.project, "I")
        put_in_module(issue, module_a)
        grant(ctx.alice, module=module_b)

        assert not can_access_issue(ctx.alice, issue.id)

    def test_soft_deleted_grant_is_ignored(self, ctx, mock_celery):
        module = make_module(ctx.project, "R", is_restricted=True)
        access = grant(ctx.alice, module=module)
        assert can_access_module(ctx.alice, module.id)

        access.delete(soft=True)
        assert not can_access_module(ctx.alice, module.id)

    def test_queryset_helper_filters_module_list(self, ctx):
        open_module = make_module(ctx.project, "open")
        secret = make_module(ctx.project, "secret", is_restricted=True)

        names = set(accessible_modules(Module.objects.all(), ctx.alice).values_list("name", flat=True))
        assert names == {"open"}
        grant(ctx.alice, module=secret)
        names = set(accessible_modules(Module.objects.all(), ctx.alice).values_list("name", flat=True))
        assert names == {"open", "secret"}
        assert open_module.id


@pytest.mark.unit
class TestModuleUnionAndInheritance:
    def test_grant_on_any_restricted_module_is_enough(self, ctx):
        module_a = make_module(ctx.project, "A", is_restricted=True)
        module_b = make_module(ctx.project, "B", is_restricted=True)
        issue = make_issue(ctx.project, "I")
        put_in_module(issue, module_a)
        put_in_module(issue, module_b)
        grant(ctx.alice, module=module_b)

        assert can_access_issue(ctx.alice, issue.id)
        assert not can_access_issue(ctx.bob, issue.id)

    def test_unrestricted_module_does_not_widen_access(self, ctx):
        restricted = make_module(ctx.project, "R", is_restricted=True)
        open_module = make_module(ctx.project, "O")
        issue = make_issue(ctx.project, "I")
        put_in_module(issue, restricted)
        put_in_module(issue, open_module)

        assert not can_access_issue(ctx.alice, issue.id)

    def test_module_grant_actions_are_inherited_by_issue(self, ctx):
        module = make_module(ctx.project, "R", is_restricted=True)
        issue = make_issue(ctx.project, "I")
        put_in_module(issue, module)
        grant(ctx.alice, module=module, comment=True)

        assert can_access_issue(ctx.alice, issue.id, VIEW)
        assert can_access_issue(ctx.alice, issue.id, COMMENT)
        assert not can_access_issue(ctx.alice, issue.id, EDIT)


@pytest.mark.unit
class TestRestrictedIssue:
    def test_issue_grants_replace_module_grants(self, ctx):
        module = make_module(ctx.project, "M", is_restricted=True)
        issue = make_issue(ctx.project, "I", is_restricted=True)
        put_in_module(issue, module)
        grant(ctx.alice, module=module)  # module grant only
        grant(ctx.bob, issue=issue)  # issue grant only

        assert not can_access_issue(ctx.alice, issue.id)
        assert can_access_issue(ctx.bob, issue.id)

    def test_restricted_issue_in_open_module_needs_issue_grant(self, ctx):
        module = make_module(ctx.project, "M")
        issue = make_issue(ctx.project, "I", is_restricted=True)
        put_in_module(issue, module)

        assert not can_access_issue(ctx.alice, issue.id)
        grant(ctx.alice, issue=issue)
        assert can_access_issue(ctx.alice, issue.id)

    def test_creator_and_assignee_can_view_but_not_comment_or_edit(self, ctx):
        issue = make_issue(ctx.project, "I", creator=ctx.alice, is_restricted=True)
        IssueAssignee.objects.create(issue=issue, assignee=ctx.bob, project=ctx.project)

        for user in (ctx.alice, ctx.bob):
            assert can_access_issue(user, issue.id, VIEW)
            assert not can_access_issue(user, issue.id, COMMENT)
            assert not can_access_issue(user, issue.id, EDIT)

    def test_creator_and_assignee_see_issue_in_restricted_module(self, ctx):
        module = make_module(ctx.project, "R", is_restricted=True)
        issue = make_issue(ctx.project, "I", creator=ctx.alice)
        IssueAssignee.objects.create(issue=issue, assignee=ctx.bob, project=ctx.project)
        put_in_module(issue, module)

        assert can_access_issue(ctx.alice, issue.id)
        assert can_access_issue(ctx.bob, issue.id)
        assert not can_access_issue(ctx.bob, issue.id, COMMENT)

    def test_unrelated_member_does_not_see_restricted_issue(self, ctx):
        issue = make_issue(ctx.project, "I", creator=ctx.alice, is_restricted=True)
        assert not can_access_issue(ctx.bob, issue.id)
        assert can_access_issue(ctx.admin, issue.id, EDIT)

    def test_accessible_issue_ids_subquery(self, ctx):
        open_issue = make_issue(ctx.project, "open")
        secret = make_issue(ctx.project, "secret", is_restricted=True)

        ids = set(Issue.objects.filter(id__in=accessible_issue_ids(ctx.alice)).values_list("id", flat=True))
        assert ids == {open_issue.id}
        grant(ctx.alice, issue=secret)
        ids = set(Issue.objects.filter(id__in=accessible_issue_ids(ctx.alice)).values_list("id", flat=True))
        assert ids == {open_issue.id, secret.id}


@pytest.mark.unit
class TestActionCombinations:
    """view / comment / edit can be combined freely."""

    @pytest.mark.parametrize(
        "flags, expected",
        [
            ({"view": True}, (True, False, False)),
            ({"view": False, "comment": True}, (True, True, False)),  # comment implies view
            ({"view": False, "edit": True}, (True, False, True)),  # edit implies view
            ({"comment": True, "edit": True}, (True, True, True)),
            ({"view": True, "comment": True}, (True, True, False)),
            ({"view": True, "edit": True}, (True, False, True)),
        ],
    )
    def test_combinations(self, ctx, flags, expected):
        issue = make_issue(ctx.project, "I", is_restricted=True)
        grant(ctx.alice, issue=issue, **flags)

        got = tuple(can_access_issue(ctx.alice, issue.id, a) for a in (VIEW, COMMENT, EDIT))
        assert got == expected


@pytest.mark.unit
class TestResourceAccessModel:
    def test_requires_exactly_one_resource(self, ctx):
        module = make_module(ctx.project, "M")
        issue = make_issue(ctx.project, "I")

        with pytest.raises(IntegrityError), transaction.atomic():
            ResourceAccess.objects.create(project=ctx.project, user=ctx.alice)  # none
        with pytest.raises(IntegrityError), transaction.atomic():
            ResourceAccess.objects.create(project=ctx.project, user=ctx.alice, module=module, issue=issue)  # both

    def test_one_grant_per_user_and_resource(self, ctx):
        module = make_module(ctx.project, "M")
        grant(ctx.alice, module=module)

        with pytest.raises(IntegrityError), transaction.atomic():
            grant(ctx.alice, module=module)

    def test_grant_can_be_recreated_after_soft_delete(self, ctx, mock_celery):
        module = make_module(ctx.project, "M")
        grant(ctx.alice, module=module).delete(soft=True)
        grant(ctx.alice, module=module)  # must not raise


@pytest.mark.unit
class TestIsRestrictedIsNotWritableThroughCrudSerializers:
    """Only the dedicated access endpoints may flip ``is_restricted``.

    The CRUD serializers use ``__all__``/``exclude``, so without read-only
    protection any project member could clear the flag with a plain PATCH.
    """

    @pytest.mark.parametrize(
        "path",
        [
            "plane.app.serializers.module.ModuleWriteSerializer",
            "plane.app.serializers.issue.IssueCreateSerializer",
            "plane.api.serializers.module.ModuleSerializer",
            "plane.api.serializers.issue.IssueSerializer",
        ],
    )
    def test_field_is_read_only(self, path):
        from importlib import import_module

        module_path, cls_name = path.rsplit(".", 1)
        serializer = getattr(import_module(module_path), cls_name)()

        assert serializer.fields["is_restricted"].read_only is True
