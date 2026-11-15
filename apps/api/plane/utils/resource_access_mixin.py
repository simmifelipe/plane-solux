# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""DRF mixin enforcing restricted module / issue access on by-id routes.

List endpoints are covered by ``Issue.issue_objects`` (which filters by the
request's user) and by the module querysets. Routes that address a single
resource by id go through this mixin instead, because they also reach archived
issues, drafts and sub-resources that ``issue_objects`` does not return.

What an URL kwarg means:

* ``issue_id`` / ``work_item_id`` and ``module_id`` always name an issue / module,
  and ``comment_id`` names a comment, which follows its issue.
* a bare ``pk`` names one only when the view sets ``access_pk_resource``.

Which action a request needs: reads need ``view``. Writes need
``access_write_action`` (``edit`` by default). Views whose writes are really
comments set it to ``comment``; per-user actions that change nothing on the
resource (subscribing, favouriting, personal view properties) set it to ``view``.

A user who cannot even view the resource gets 404, so its existence is not
revealed. A user who can view it but lacks the action gets 403.
"""

# Third party imports
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import SAFE_METHODS

# Module imports
from plane.db.models import IssueComment
from plane.utils.resource_access import AccessAction, can_access_issue, can_access_module

_ISSUE_KWARGS = ("issue_id", "work_item_id")
_MODULE_KWARGS = ("module_id",)


def can_access_comment(user, comment_id, action=AccessAction.VIEW):
    """A comment is governed by the issue it belongs to."""
    issue_id = IssueComment.objects.filter(pk=comment_id).values_list("issue_id", flat=True).first()
    return issue_id is not None and can_access_issue(user, issue_id, action)


class ResourceAccessMixin:
    access_pk_resource = None  # "issue" | "module" | None
    access_write_action = AccessAction.EDIT

    def initial(self, request, *args, **kwargs):
        # After super(): authentication and permission classes have already run
        super().initial(request, *args, **kwargs)
        self.check_resource_access(request)

    def _access_targets(self):
        """Yield (checker, resource_id) pairs addressed by this request's URL."""
        url_kwargs = getattr(self, "kwargs", None) or {}

        for name in _ISSUE_KWARGS:
            if url_kwargs.get(name):
                yield can_access_issue, url_kwargs[name]
        for name in _MODULE_KWARGS:
            if url_kwargs.get(name):
                yield can_access_module, url_kwargs[name]

        if url_kwargs.get("comment_id"):
            yield can_access_comment, url_kwargs["comment_id"]

        pk = url_kwargs.get("pk")
        if pk and self.access_pk_resource == "issue":
            yield can_access_issue, pk
        elif pk and self.access_pk_resource == "module":
            yield can_access_module, pk

    def check_resource_access(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return

        needed = AccessAction.VIEW if request.method in SAFE_METHODS else self.access_write_action

        for checker, resource_id in self._access_targets():
            if not checker(user, resource_id, AccessAction.VIEW):
                raise NotFound()
            if needed != AccessAction.VIEW and not checker(user, resource_id, needed):
                raise PermissionDenied("You don't have the required permissions.")
