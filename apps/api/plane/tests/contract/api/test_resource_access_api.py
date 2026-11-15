# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Restricted module / issue access on the public API (``/api/v1``, API-key auth).

The per-user issue filter lives in ``Issue.issue_objects`` and reads the request
user through ``crum``. These tests prove it also works when the user is
authenticated by an API key rather than a session.
"""

from uuid import uuid4

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import (
    APIToken,
    Issue,
    Module,
    ModuleIssue,
    Project,
    ProjectMember,
    ResourceAccess,
    User,
    WorkspaceMember,
)

BASE = "/api/v1/workspaces/{slug}/projects/{pid}"


def _member(workspace, project):
    uid = uuid4().hex[:8]
    user = User.objects.create(email=f"k-{uid}@plane.so", username=f"k_{uid}", first_name="K", last_name=uid)
    user.set_password("test-password")
    user.save()
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    ProjectMember.objects.create(project=project, member=user, workspace=workspace, role=15)
    return user


def _key_client(user):
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=APIToken.objects.create(user=user).token)
    return client


def _issue(project, name, creator, **kwargs):
    issue = Issue(project=project, workspace=project.workspace, name=name, **kwargs)
    issue.save(created_by_id=creator.id)
    return issue


def _rows(response):
    data = response.data
    return data["results"] if isinstance(data, dict) and "results" in data else data


@pytest.fixture
def world(db, workspace, create_user, mock_celery):
    project = Project.objects.create(name="API RA", identifier="AR", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)

    class W:
        pass

    w = W()
    w.slug, w.pid, w.project, w.workspace = workspace.slug, project.id, project, workspace
    w.admin, w.alice, w.bob = create_user, _member(workspace, project), _member(workspace, project)

    w.module = Module(project=project, workspace=workspace, name="Secret", is_restricted=True)
    w.module.save(created_by_id=create_user.id)
    w.in_module = _issue(project, "in restricted module", create_user)
    ModuleIssue.objects.create(issue=w.in_module, module=w.module, project=project)
    w.open_issue = _issue(project, "open issue", create_user)
    w.secret_issue = _issue(project, "secret issue", create_user, is_restricted=True)
    return w


@pytest.mark.contract
class TestPublicApiAccess:
    def test_issue_list_is_filtered_per_api_key_user(self, world):
        w = world
        url = BASE.format(slug=w.slug, pid=w.pid) + "/issues/"

        bob = {r["name"] for r in _rows(_key_client(w.bob).get(url))}
        assert bob == {"open issue"}

        admin = {r["name"] for r in _rows(_key_client(w.admin).get(url))}
        assert admin == {"open issue", "in restricted module", "secret issue"}

    def test_grant_reveals_issue_through_api_key(self, world):
        w = world
        ResourceAccess.objects.create(project=w.project, module=w.module, user=w.alice)
        url = BASE.format(slug=w.slug, pid=w.pid) + "/issues/"
        names = {r["name"] for r in _rows(_key_client(w.alice).get(url))}
        assert names == {"open issue", "in restricted module"}

    def test_issue_detail_by_id(self, world):
        w = world
        client = _key_client(w.bob)
        base = BASE.format(slug=w.slug, pid=w.pid)
        assert client.get(f"{base}/issues/{w.secret_issue.id}/").status_code == status.HTTP_404_NOT_FOUND
        assert client.get(f"{base}/issues/{w.in_module.id}/").status_code == status.HTTP_404_NOT_FOUND
        assert client.get(f"{base}/issues/{w.open_issue.id}/").status_code == status.HTTP_200_OK

    def test_issue_detail_by_identifier(self, world):
        w = world
        url = f"/api/v1/workspaces/{w.slug}/work-items/AR-{w.secret_issue.sequence_id}/"
        assert _key_client(w.bob).get(url).status_code == status.HTTP_404_NOT_FOUND
        assert _key_client(w.admin).get(url).status_code == status.HTTP_200_OK

    def test_search_does_not_leak_restricted_issues(self, world):
        w = world
        url = f"/api/v1/workspaces/{w.slug}/work-items/search/"
        response = _key_client(w.bob).get(url, {"search": "secret"})
        assert response.status_code == status.HTTP_200_OK, response.data
        assert list(response.data["issues"]) == []

        # Positive control: the same search does find it for someone who may see it
        admin = _key_client(w.admin).get(url, {"search": "secret"})
        assert [row["name"] for row in admin.data["issues"]] == ["secret issue"]

    def test_module_list_and_detail(self, world):
        w = world
        base = BASE.format(slug=w.slug, pid=w.pid)
        bob = _key_client(w.bob)
        assert {m["name"] for m in _rows(bob.get(f"{base}/modules/"))} == set()
        assert bob.get(f"{base}/modules/{w.module.id}/").status_code == status.HTTP_404_NOT_FOUND

        admin = _key_client(w.admin)
        assert {m["name"] for m in _rows(admin.get(f"{base}/modules/"))} == {"Secret"}
        assert admin.get(f"{base}/modules/{w.module.id}/").status_code == status.HTTP_200_OK

    def test_is_restricted_is_not_writable(self, world):
        w = world
        url = BASE.format(slug=w.slug, pid=w.pid) + f"/issues/{w.open_issue.id}/"
        _key_client(w.bob).patch(url, {"is_restricted": True}, format="json")
        w.open_issue.refresh_from_db()
        assert w.open_issue.is_restricted is False
