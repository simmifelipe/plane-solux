# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Edge cases of restricted module / issue access: body-supplied ids, notifications, intake, exports."""

import json
import zipfile
from unittest.mock import patch
from uuid import uuid4

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.bgtasks.export_task import issue_export_task
from plane.db.models import (
    Cycle,
    CycleIssue,
    ExporterHistory,
    Intake,
    IntakeIssue,
    Issue,
    Module,
    ModuleIssue,
    Notification,
    Project,
    ProjectMember,
    ResourceAccess,
    User,
    WorkspaceMember,
)

BASE = "/api/workspaces/{slug}/projects/{pid}"


def _user(workspace, project, role=15):
    uid = uuid4().hex[:8]
    user = User.objects.create(email=f"e-{uid}@plane.so", username=f"e_{uid}", first_name="E", last_name=uid)
    user.set_password("test-password")
    user.save()
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    ProjectMember.objects.create(project=project, member=user, workspace=workspace, role=role)
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _issue(project, name, creator, **kwargs):
    issue = Issue(project=project, workspace=project.workspace, name=name, **kwargs)
    issue.save(created_by_id=creator.id)
    return issue


@pytest.fixture
def world(db, workspace, create_user, mock_celery):
    project = Project.objects.create(name="Edges", identifier="ED", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)

    class W:
        pass

    w = W()
    w.workspace, w.project, w.slug, w.pid = workspace, project, workspace.slug, project.id
    w.admin = create_user
    w.alice, w.bob = _user(workspace, project), _user(workspace, project)
    w.module = Module(project=project, workspace=workspace, name="Secret", is_restricted=True)
    w.module.save(created_by_id=create_user.id)
    w.open_issue = _issue(project, "open issue", create_user)
    w.secret_issue = _issue(project, "secret issue", create_user, is_restricted=True)
    return w


@pytest.mark.contract
class TestAddingIssuesToModules:
    def url(self, w, issue):
        return BASE.format(slug=w.slug, pid=w.pid) + f"/issues/{issue.id}/modules/"

    def test_cannot_link_an_issue_to_a_module_you_cannot_edit(self, world):
        w = world
        response = _client(w.bob).post(self.url(w, w.open_issue), {"modules": [str(w.module.id)]}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert not ModuleIssue.objects.filter(module=w.module).exists()

    def test_view_only_grant_is_not_enough(self, world):
        w = world
        ResourceAccess.objects.create(project=w.project, module=w.module, user=w.alice, can_view=True)
        _client(w.alice).post(self.url(w, w.open_issue), {"modules": [str(w.module.id)]}, format="json")
        assert not ModuleIssue.objects.filter(module=w.module).exists()

    def test_edit_grant_can_link_and_unlink(self, world):
        w = world
        ResourceAccess.objects.create(project=w.project, module=w.module, user=w.alice, can_edit=True)
        client = _client(w.alice)
        client.post(self.url(w, w.open_issue), {"modules": [str(w.module.id)]}, format="json")
        assert ModuleIssue.objects.filter(module=w.module, issue=w.open_issue).exists()
        client.post(self.url(w, w.open_issue), {"removed_modules": [str(w.module.id)]}, format="json")
        assert not ModuleIssue.objects.filter(module=w.module, issue=w.open_issue).exists()

    def test_cannot_unlink_from_a_module_you_cannot_edit(self, world):
        w = world
        ModuleIssue.objects.create(issue=w.open_issue, module=w.module, project=w.project)
        # bob cannot even see the issue now (it sits in a restricted module), so the URL itself is refused
        response = _client(w.bob).post(
            self.url(w, w.open_issue), {"removed_modules": [str(w.module.id)]}, format="json"
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert ModuleIssue.objects.filter(module=w.module, issue=w.open_issue).exists()


@pytest.mark.contract
class TestAddingIssuesToCycles:
    def test_hidden_issue_is_not_moved_into_my_cycle(self, world):
        w = world
        other = Cycle.objects.create(name="Other", project=w.project, workspace=w.workspace, owned_by=w.admin)
        mine = Cycle.objects.create(name="Mine", project=w.project, workspace=w.workspace, owned_by=w.admin)
        CycleIssue.objects.create(issue=w.secret_issue, cycle=other, project=w.project, workspace=w.workspace)

        url = BASE.format(slug=w.slug, pid=w.pid) + f"/cycles/{mine.id}/cycle-issues/"
        _client(w.bob).post(url, {"issues": [str(w.secret_issue.id), str(w.open_issue.id)]}, format="json")

        assert CycleIssue.objects.get(issue=w.secret_issue).cycle_id == other.id
        assert CycleIssue.objects.filter(issue=w.open_issue, cycle=mine).exists()


@pytest.mark.contract
class TestNotifications:
    def _notify(self, w, issue, receiver):
        return Notification.objects.create(
            workspace=w.workspace,
            project=w.project,
            entity_name="issue",
            entity_identifier=issue.id,
            title="t",
            sender="in_app:issue_activities:updated",
            receiver=receiver,
        )

    def _ids(self, client, w):
        response = client.get(f"/api/workspaces/{w.slug}/users/notifications/")
        assert response.status_code == status.HTTP_200_OK, response.data
        data = response.data
        rows = data["results"] if isinstance(data, dict) and "results" in data else data
        return {str(r["entity_identifier"]) for r in rows}

    def test_notifications_about_hidden_issues_disappear(self, world):
        w = world
        self._notify(w, w.secret_issue, w.bob)
        self._notify(w, w.open_issue, w.bob)
        assert self._ids(_client(w.bob), w) == {str(w.open_issue.id)}

    def test_granted_user_keeps_their_notification(self, world):
        w = world
        ResourceAccess.objects.create(project=w.project, issue=w.secret_issue, user=w.alice)
        self._notify(w, w.secret_issue, w.alice)
        assert self._ids(_client(w.alice), w) == {str(w.secret_issue.id)}

    def test_unread_count_ignores_hidden_issues(self, world):
        w = world
        self._notify(w, w.secret_issue, w.bob)
        response = _client(w.bob).get(f"/api/workspaces/{w.slug}/users/notifications/unread/")
        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data["total_unread_notifications_count"] == 0


@pytest.mark.contract
class TestIntake:
    def test_hidden_intake_issue_is_404(self, world):
        w = world
        intake = Intake.objects.create(name="Intake", project=w.project, workspace=w.workspace, is_default=True)
        IntakeIssue.objects.create(intake=intake, issue=w.secret_issue, project=w.project, workspace=w.workspace)
        url = BASE.format(slug=w.slug, pid=w.pid) + f"/intake-issues/{w.secret_issue.id}/"
        assert _client(w.bob).get(url).status_code == status.HTTP_404_NOT_FOUND

        listing = _client(w.bob).get(BASE.format(slug=w.slug, pid=w.pid) + "/intake-issues/")
        assert listing.status_code == status.HTTP_200_OK, listing.data
        assert str(w.secret_issue.id) not in json.dumps(listing.data, default=str)


@pytest.mark.contract
class TestExport:
    def _exported(self, w, user):
        exporter = ExporterHistory.objects.create(
            workspace=w.workspace, project=[w.project.id], initiated_by=user, provider="json", type="issue_exports"
        )
        with patch("plane.bgtasks.export_task.upload_to_s3") as upload:
            issue_export_task(
                provider="json",
                workspace_id=w.workspace.id,
                project_ids=[str(w.project.id)],
                token_id=exporter.token,
                multiple=False,
                slug=w.workspace.slug,
            )
        assert upload.called, ExporterHistory.objects.get(pk=exporter.pk).reason
        with zipfile.ZipFile(upload.call_args.args[0]) as zf:
            return {row["name"] for f in zf.namelist() for row in json.loads(zf.read(f))}

    def test_export_only_contains_what_the_requester_may_see(self, world):
        w = world
        assert self._exported(w, w.bob) == {"open issue"}
        assert self._exported(w, w.admin) == {"open issue", "secret issue"}


@pytest.mark.contract
class TestAggregateCounts:
    def test_module_totals_exclude_issues_the_user_cannot_see(self, world):
        w = world
        ResourceAccess.objects.create(project=w.project, module=w.module, user=w.alice)
        visible = _issue(w.project, "visible", w.admin)
        hidden = _issue(w.project, "hidden", w.admin, is_restricted=True)
        for issue in (visible, hidden):
            ModuleIssue.objects.create(issue=issue, module=w.module, project=w.project)

        def total(user):
            rows = _client(user).get(BASE.format(slug=w.slug, pid=w.pid) + "/modules/").data
            return next(r for r in rows if str(r["id"]) == str(w.module.id))["total_issues"]

        assert total(w.alice) == 1
        assert total(w.admin) == 2
