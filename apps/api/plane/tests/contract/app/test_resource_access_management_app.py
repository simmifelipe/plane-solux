# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the endpoints that manage module / issue access grants."""

from uuid import uuid4

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import (
    Issue,
    Module,
    Project,
    ProjectMember,
    ResourceAccess,
    User,
    WorkspaceMember,
)

BASE = "/api/workspaces/{slug}/projects/{pid}"


def _user(workspace, project, role=15):
    uid = uuid4().hex[:8]
    user = User.objects.create(email=f"m-{uid}@plane.so", username=f"m_{uid}", first_name="M", last_name=uid)
    user.set_password("test-password")
    user.save()
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15 if role != 5 else 5)
    if project is not None:
        ProjectMember.objects.create(project=project, member=user, workspace=workspace, role=role)
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def world(db, workspace, create_user, mock_celery):
    project = Project.objects.create(name="Mgmt", identifier="MG", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)

    class W:
        pass

    w = W()
    w.workspace, w.project, w.slug, w.pid = workspace, project, workspace.slug, project.id
    w.admin = create_user
    w.alice, w.bob = _user(workspace, project), _user(workspace, project)
    w.outsider = _user(workspace, None)  # workspace member, not in the project

    w.module = Module(project=project, workspace=workspace, name="M")
    w.module.save(created_by_id=create_user.id)
    w.issue = Issue(project=project, workspace=workspace, name="I")
    w.issue.save(created_by_id=create_user.id)
    return w


def access_url(w, kind, resource, user=None):
    path = f"/modules/{resource.id}/access/" if kind == "module" else f"/issues/{resource.id}/access/"
    return BASE.format(slug=w.slug, pid=w.pid) + path + (f"{user.id}/" if user else "")


def resource_of(w, kind):
    return w.module if kind == "module" else w.issue


KINDS = ["module", "issue"]


@pytest.mark.contract
@pytest.mark.parametrize("kind", KINDS)
class TestManageAccess:
    def test_admin_reads_state(self, world, kind):
        w = world
        response = _client(w.admin).get(access_url(w, kind, resource_of(w, kind)))
        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data == {"is_restricted": False, "grants": []}

    def test_admin_toggles_restriction(self, world, kind):
        w = world
        resource = resource_of(w, kind)
        url = access_url(w, kind, resource)

        on = _client(w.admin).patch(url, {"is_restricted": True}, format="json")
        assert on.status_code == status.HTTP_200_OK, on.data
        assert on.data["is_restricted"] is True
        resource.refresh_from_db()
        assert resource.is_restricted is True

        off = _client(w.admin).patch(url, {"is_restricted": False}, format="json")
        assert off.data["is_restricted"] is False

    def test_create_then_replace_grant(self, world, kind):
        w = world
        resource = resource_of(w, kind)
        url = access_url(w, kind, resource)

        created = _client(w.admin).post(url, {"user_id": str(w.alice.id), "can_comment": True}, format="json")
        assert created.status_code == status.HTTP_201_CREATED, created.data
        assert (created.data["can_view"], created.data["can_comment"], created.data["can_edit"]) == (
            True,
            True,
            False,
        )

        replaced = _client(w.admin).post(url, {"user_id": str(w.alice.id), "can_edit": True}, format="json")
        assert replaced.status_code == status.HTTP_200_OK, replaced.data
        assert (replaced.data["can_comment"], replaced.data["can_edit"]) == (False, True)
        assert ResourceAccess.objects.filter(user=w.alice).count() == 1

        listed = _client(w.admin).get(url).data["grants"]
        assert [g["user_id"] for g in listed] == [str(w.alice.id)]

    def test_edit_or_comment_only_still_implies_view(self, world, kind):
        w = world
        url = access_url(w, kind, resource_of(w, kind))
        response = _client(w.admin).post(
            url, {"user_id": str(w.alice.id), "can_view": False, "can_edit": True}, format="json"
        )
        assert response.data["can_view"] is True

    def test_grant_with_no_action_is_rejected(self, world, kind):
        w = world
        url = access_url(w, kind, resource_of(w, kind))
        response = _client(w.admin).post(
            url, {"user_id": str(w.alice.id), "can_view": False, "can_comment": False, "can_edit": False}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not ResourceAccess.objects.exists()

    def test_cannot_grant_to_someone_outside_the_project(self, world, kind):
        w = world
        url = access_url(w, kind, resource_of(w, kind))
        response = _client(w.admin).post(url, {"user_id": str(w.outsider.id)}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not ResourceAccess.objects.exists()

    def test_delete_grant(self, world, kind):
        w = world
        resource = resource_of(w, kind)
        _client(w.admin).post(access_url(w, kind, resource), {"user_id": str(w.alice.id)}, format="json")

        url = access_url(w, kind, resource, w.alice)
        assert _client(w.admin).delete(url).status_code == status.HTTP_204_NO_CONTENT
        assert not ResourceAccess.objects.filter(user=w.alice).exists()
        assert _client(w.admin).delete(url).status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.contract
@pytest.mark.parametrize("kind", KINDS)
class TestOnlyAdminsManageAccess:
    def test_plain_member_is_refused(self, world, kind):
        w = world
        resource = resource_of(w, kind)
        client = _client(w.bob)
        url = access_url(w, kind, resource)

        assert client.get(url).status_code == status.HTTP_403_FORBIDDEN
        assert client.patch(url, {"is_restricted": True}, format="json").status_code == status.HTTP_403_FORBIDDEN
        assert client.post(url, {"user_id": str(w.bob.id)}, format="json").status_code == status.HTTP_403_FORBIDDEN
        resource.refresh_from_db()
        assert resource.is_restricted is False
        assert not ResourceAccess.objects.exists()

    def test_edit_grant_does_not_allow_self_escalation(self, world, kind):
        """Holding can_edit on a restricted resource must not let you manage who else has access."""
        w = world
        resource = resource_of(w, kind)
        type(resource).objects.filter(pk=resource.pk).update(is_restricted=True)
        ResourceAccess.objects.create(project=w.project, user=w.alice, can_edit=True, **{kind: resource})

        client = _client(w.alice)
        url = access_url(w, kind, resource)
        assert client.get(url).status_code == status.HTTP_403_FORBIDDEN
        response = client.post(url, {"user_id": str(w.bob.id), "can_edit": True}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert not ResourceAccess.objects.filter(user=w.bob).exists()

    def test_user_without_access_gets_404(self, world, kind):
        w = world
        resource = resource_of(w, kind)
        type(resource).objects.filter(pk=resource.pk).update(is_restricted=True)
        assert _client(w.bob).get(access_url(w, kind, resource)).status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.contract
class TestIsolationAndNarrowing:
    def test_resource_from_another_project_is_404(self, world, create_user):
        w = world
        other = Project.objects.create(name="Other", identifier="OT", workspace=w.workspace, created_by=create_user)
        ProjectMember.objects.create(project=other, member=create_user, workspace=w.workspace, role=20)
        foreign = Module(project=other, workspace=w.workspace, name="Foreign")
        foreign.save(created_by_id=create_user.id)

        # admin of both, but the module does not live in the URL's project
        url = BASE.format(slug=w.slug, pid=w.pid) + f"/modules/{foreign.id}/access/"
        assert _client(w.admin).get(url).status_code == status.HTTP_404_NOT_FOUND
        assert (
            _client(w.admin).post(url, {"user_id": str(w.alice.id)}, format="json").status_code
            == status.HTTP_404_NOT_FOUND
        )

    def test_end_to_end_restrict_grant_revoke(self, world):
        w = world
        url = access_url(w, "issue", w.issue)
        detail = BASE.format(slug=w.slug, pid=w.pid) + f"/issues/{w.issue.id}/"
        admin = _client(w.admin)

        assert _client(w.bob).get(detail).status_code == status.HTTP_200_OK  # open to everyone

        admin.patch(url, {"is_restricted": True}, format="json")
        assert _client(w.bob).get(detail).status_code == status.HTTP_404_NOT_FOUND

        admin.post(url, {"user_id": str(w.bob.id)}, format="json")
        assert _client(w.bob).get(detail).status_code == status.HTTP_200_OK

        admin.delete(access_url(w, "issue", w.issue, w.bob))
        assert _client(w.bob).get(detail).status_code == status.HTTP_404_NOT_FOUND

        admin.patch(url, {"is_restricted": False}, format="json")
        assert _client(w.bob).get(detail).status_code == status.HTTP_200_OK

    def test_grants_never_widen_the_project_role(self, world):
        """A guest holding can_edit still cannot edit: the role check on the endpoint wins."""
        w = world
        guest = _user(w.workspace, w.project, role=5)
        Issue.objects.filter(pk=w.issue.pk).update(is_restricted=True)
        ResourceAccess.objects.create(project=w.project, issue=w.issue, user=guest, can_edit=True)

        detail = BASE.format(slug=w.slug, pid=w.pid) + f"/issues/{w.issue.id}/"
        response = _client(guest).patch(detail, {"name": "pwned"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN
        w.issue.refresh_from_db()
        assert w.issue.name == "I"


@pytest.mark.contract
@pytest.mark.parametrize("kind", KINDS)
class TestMyAccess:
    def url(self, w, kind):
        resource = resource_of(w, kind)
        return BASE.format(slug=w.slug, pid=w.pid) + f"/{kind}s/{resource.id}/my-access/"

    def restrict(self, w, kind):
        resource = resource_of(w, kind)
        type(resource).objects.filter(pk=resource.pk).update(is_restricted=True)

    def test_open_resource_for_a_member(self, world, kind):
        response = _client(world.bob).get(self.url(world, kind))
        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data == {
            "is_restricted": False,
            "can_view": True,
            "can_comment": True,
            "can_edit": True,
            "can_manage_access": False,
        }

    def test_admin_can_manage_access(self, world, kind):
        self.restrict(world, kind)
        response = _client(world.admin).get(self.url(world, kind))
        assert response.data["can_manage_access"] is True
        assert response.data["can_edit"] is True

    def test_view_only_grant_reports_view_only(self, world, kind):
        w = world
        self.restrict(w, kind)
        ResourceAccess.objects.create(project=w.project, user=w.alice, **{kind: resource_of(w, kind)})
        response = _client(w.alice).get(self.url(w, kind))
        assert response.data["is_restricted"] is True
        assert (response.data["can_view"], response.data["can_comment"], response.data["can_edit"]) == (
            True,
            False,
            False,
        )

    def test_hidden_resource_is_404(self, world, kind):
        self.restrict(world, kind)
        assert _client(world.bob).get(self.url(world, kind)).status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.contract
class TestModuleListExposesAccess:
    def test_list_carries_flags(self, world):
        w = world
        Module.objects.filter(pk=w.module.pk).update(is_restricted=True)
        ResourceAccess.objects.create(project=w.project, user=w.alice, module=w.module, can_comment=True)
        rows = _client(w.alice).get(BASE.format(slug=w.slug, pid=w.pid) + "/modules/").data
        row = next(r for r in rows if str(r["id"]) == str(w.module.id))
        assert (row["is_restricted"], row["can_comment"], row["can_edit"]) == (True, True, False)
