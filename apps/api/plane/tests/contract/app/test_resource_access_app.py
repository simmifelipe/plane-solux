# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for restricted module / issue access on the app API.

Covers the enforcement points: per-user filtering of lists (``Issue.issue_objects``
and the module querysets), the by-id mixin (404 when the user cannot view, 403
when they can view but lack the action) and the ``is_restricted`` flag staying
read-only on the regular CRUD endpoints.
"""

from uuid import uuid4

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import (
    Issue,
    IssueComment,
    Module,
    ModuleIssue,
    Project,
    ProjectMember,
    ResourceAccess,
    User,
    WorkspaceMember,
)

BASE = "/api/workspaces/{slug}/projects/{pid}"


def _user(workspace, project, role=15):
    uid = uuid4().hex[:8]
    user = User.objects.create(email=f"u-{uid}@plane.so", username=f"u_{uid}", first_name="U", last_name=uid)
    user.set_password("test-password")
    user.save()
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    ProjectMember.objects.create(project=project, member=user, workspace=workspace, role=role)
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _issue(project, name, creator=None, **kwargs):
    issue = Issue(project=project, workspace=project.workspace, name=name, **kwargs)
    issue.save(created_by_id=creator.id if creator else None)
    return issue


def _grant(user, *, module=None, issue=None, **flags):
    return ResourceAccess.objects.create(
        project=(module or issue).project, module=module, issue=issue, user=user, **flags
    )


@pytest.fixture
def world(db, workspace, create_user, mock_celery):
    """create_user is project admin. alice has grants, bob has none."""
    project = Project.objects.create(name="RA Project", identifier="RA", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)

    class W:
        pass

    w = W()
    w.workspace, w.project, w.slug, w.pid = workspace, project, workspace.slug, project.id
    w.admin = create_user
    w.alice = _user(workspace, project)
    w.bob = _user(workspace, project)

    w.module = Module(project=project, workspace=workspace, name="Secret", is_restricted=True)
    w.module.save(created_by_id=create_user.id)
    w.open_module = Module(project=project, workspace=workspace, name="Open")
    w.open_module.save(created_by_id=create_user.id)

    w.in_module = _issue(project, "in restricted module", creator=create_user)
    ModuleIssue.objects.create(issue=w.in_module, module=w.module, project=project)
    w.open_issue = _issue(project, "open issue", creator=create_user)
    w.secret_issue = _issue(project, "secret issue", creator=create_user, is_restricted=True)
    return w


def issues_list(client, w, *issues):
    url = BASE.format(slug=w.slug, pid=w.pid) + "/issues/list/"
    response = client.get(url, {"issues": ",".join(str(i.id) for i in issues)})
    assert response.status_code == status.HTTP_200_OK, response.data
    return {str(row["id"]) for row in response.data}


@pytest.mark.contract
class TestIssueListFiltering:
    def test_member_without_grants_only_sees_open_issues(self, world):
        w = world
        seen = issues_list(_client(w.bob), w, w.open_issue, w.in_module, w.secret_issue)
        assert seen == {str(w.open_issue.id)}

    def test_grants_reveal_issues(self, world):
        w = world
        _grant(w.alice, module=w.module)
        _grant(w.alice, issue=w.secret_issue)
        seen = issues_list(_client(w.alice), w, w.open_issue, w.in_module, w.secret_issue)
        assert seen == {str(i.id) for i in (w.open_issue, w.in_module, w.secret_issue)}

    def test_admin_sees_everything(self, world):
        w = world
        seen = issues_list(_client(w.admin), w, w.open_issue, w.in_module, w.secret_issue)
        assert len(seen) == 3

    def test_creator_and_assignee_keep_seeing_a_restricted_issue(self, world):
        w = world
        mine = _issue(w.project, "mine", creator=w.bob, is_restricted=True)
        assert issues_list(_client(w.bob), w, mine) == {str(mine.id)}


@pytest.mark.contract
class TestIssueDetailAccess:
    def url(self, w, issue):
        return BASE.format(slug=w.slug, pid=w.pid) + f"/issues/{issue.id}/"

    def test_hidden_issue_is_404_not_403(self, world):
        w = world
        client = _client(w.bob)
        assert client.get(self.url(w, w.in_module)).status_code == status.HTTP_404_NOT_FOUND
        assert client.get(self.url(w, w.secret_issue)).status_code == status.HTTP_404_NOT_FOUND

    def test_granted_user_can_read(self, world):
        w = world
        _grant(w.alice, issue=w.secret_issue)
        response = _client(w.alice).get(self.url(w, w.secret_issue))
        assert response.status_code == status.HTTP_200_OK, response.data

    def test_open_issue_unchanged_for_everyone(self, world):
        w = world
        assert _client(w.bob).get(self.url(w, w.open_issue)).status_code == status.HTTP_200_OK

    def test_view_only_grant_cannot_edit(self, world):
        w = world
        _grant(w.alice, issue=w.secret_issue, can_view=True)
        response = _client(w.alice).patch(self.url(w, w.secret_issue), {"name": "renamed"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN
        w.secret_issue.refresh_from_db()
        assert w.secret_issue.name == "secret issue"

    def test_edit_grant_can_edit(self, world, mock_celery):
        w = world
        _grant(w.alice, issue=w.secret_issue, can_edit=True)
        response = _client(w.alice).patch(self.url(w, w.secret_issue), {"name": "renamed"}, format="json")
        assert response.status_code == status.HTTP_204_NO_CONTENT, response.data  # Plane's PATCH success code
        w.secret_issue.refresh_from_db()
        assert w.secret_issue.name == "renamed"

    def test_module_grant_is_inherited_by_unrestricted_issue(self, world):
        w = world
        _grant(w.alice, module=w.module)
        assert _client(w.alice).get(self.url(w, w.in_module)).status_code == status.HTTP_200_OK
        assert _client(w.bob).get(self.url(w, w.in_module)).status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.contract
class TestComments:
    def url(self, w, issue):
        return BASE.format(slug=w.slug, pid=w.pid) + f"/issues/{issue.id}/comments/"

    def test_cannot_list_or_post_comments_on_hidden_issue(self, world):
        w = world
        client = _client(w.bob)
        assert client.get(self.url(w, w.secret_issue)).status_code == status.HTTP_404_NOT_FOUND
        response = client.post(self.url(w, w.secret_issue), {"comment_html": "<p>x</p>"}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert not IssueComment.objects.filter(issue=w.secret_issue).exists()

    def test_view_only_user_can_read_but_not_comment(self, world, mock_celery):
        w = world
        _grant(w.alice, issue=w.secret_issue, can_view=True)
        client = _client(w.alice)
        assert client.get(self.url(w, w.secret_issue)).status_code == status.HTTP_200_OK
        response = client.post(self.url(w, w.secret_issue), {"comment_html": "<p>x</p>"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_comment_grant_can_comment_but_not_edit(self, world, mock_celery):
        w = world
        _grant(w.alice, issue=w.secret_issue, can_comment=True)
        client = _client(w.alice)
        response = client.post(self.url(w, w.secret_issue), {"comment_html": "<p>hi</p>"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED, response.data
        edit = client.patch(
            BASE.format(slug=w.slug, pid=w.pid) + f"/issues/{w.secret_issue.id}/", {"name": "x"}, format="json"
        )
        assert edit.status_code == status.HTTP_403_FORBIDDEN

    def test_comment_reaction_follows_the_issue(self, world):
        """The reactions URL carries only comment_id, never the issue id."""
        w = world
        comment = IssueComment.objects.create(
            issue=w.secret_issue, project=w.project, workspace=w.workspace, comment_html="<p>c</p>"
        )
        url = BASE.format(slug=w.slug, pid=w.pid) + f"/comments/{comment.id}/reactions/"
        assert _client(w.bob).get(url).status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.contract
class TestModuleAccess:
    def list_names(self, client, w):
        response = client.get(BASE.format(slug=w.slug, pid=w.pid) + "/modules/")
        assert response.status_code == status.HTTP_200_OK, response.data
        return {m["name"] for m in response.data}

    def test_restricted_module_hidden_from_list(self, world):
        w = world
        assert self.list_names(_client(w.bob), w) == {"Open"}

    def test_granted_user_and_admin_see_it(self, world):
        w = world
        _grant(w.alice, module=w.module)
        assert self.list_names(_client(w.alice), w) == {"Open", "Secret"}
        assert self.list_names(_client(w.admin), w) == {"Open", "Secret"}

    def test_module_detail_by_id(self, world):
        w = world
        url = BASE.format(slug=w.slug, pid=w.pid) + f"/modules/{w.module.id}/"
        assert _client(w.bob).get(url).status_code == status.HTTP_404_NOT_FOUND
        _grant(w.alice, module=w.module)
        assert _client(w.alice).get(url).status_code == status.HTTP_200_OK

    def test_module_issue_list_is_blocked(self, world):
        w = world
        url = BASE.format(slug=w.slug, pid=w.pid) + f"/modules/{w.module.id}/issues/"
        assert _client(w.bob).get(url).status_code == status.HTTP_404_NOT_FOUND

    def test_view_only_module_grant_cannot_modify_module(self, world):
        w = world
        _grant(w.alice, module=w.module, can_view=True)
        url = BASE.format(slug=w.slug, pid=w.pid) + f"/modules/{w.module.id}/"
        response = _client(w.alice).patch(url, {"name": "hacked"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN
        w.module.refresh_from_db()
        assert w.module.name == "Secret"


@pytest.mark.contract
class TestRestrictionFlagIsNotWritable:
    def test_member_cannot_unrestrict_an_issue_via_patch(self, world, mock_celery):
        w = world
        _grant(w.alice, issue=w.secret_issue, can_edit=True)
        url = BASE.format(slug=w.slug, pid=w.pid) + f"/issues/{w.secret_issue.id}/"
        _client(w.alice).patch(url, {"is_restricted": False, "name": "ok"}, format="json")
        w.secret_issue.refresh_from_db()
        assert w.secret_issue.is_restricted is True

    def test_member_cannot_restrict_an_issue_via_patch(self, world, mock_celery):
        w = world
        url = BASE.format(slug=w.slug, pid=w.pid) + f"/issues/{w.open_issue.id}/"
        _client(w.bob).patch(url, {"is_restricted": True, "name": "ok"}, format="json")
        w.open_issue.refresh_from_db()
        assert w.open_issue.is_restricted is False


@pytest.mark.contract
class TestSystemCodeIsNotFiltered:
    def test_unrestricted_access_context_sees_everything(self, world):
        from crum import impersonate

        from plane.utils.resource_access import unrestricted_access

        w = world
        with impersonate(w.bob):
            assert Issue.issue_objects.filter(project=w.project).count() == 1
            with unrestricted_access():
                assert Issue.issue_objects.filter(project=w.project).count() == 3
            assert Issue.issue_objects.filter(project=w.project).count() == 1

    def test_no_request_user_means_no_filtering(self, world):
        """Celery tasks and management commands have no request user."""
        assert Issue.issue_objects.filter(project=world.project).count() == 3
