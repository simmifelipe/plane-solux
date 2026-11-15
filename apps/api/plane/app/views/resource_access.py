# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Endpoints that manage who can see / comment on / edit a restricted module or issue.

Only project admins (and workspace admins who are project members) may use them.

Grants only ever *narrow* access: they are checked in addition to the normal project
role rules, never instead of them. A project guest given ``can_edit`` still cannot
edit, because the role check on the edit endpoint rejects them first.

Routes (``<kind>`` is ``modules/<module_id>`` or ``issues/<issue_id>``)::

    GET    <kind>/my-access/         -> what the current user may do (any project member)
    GET    <kind>/access/            -> {"is_restricted": bool, "grants": [...]}
    PATCH  <kind>/access/            -> turn the restriction on or off
    POST   <kind>/access/            -> create or replace one user's grant
    DELETE <kind>/access/<user_id>/  -> remove one user's grant
"""

# Django imports
from django.utils import timezone

# Third party imports
from rest_framework import serializers, status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.db.models import Issue, Module, ProjectMember, ResourceAccess
from plane.utils.resource_access import effective_access


class ResourceAccessSerializer(serializers.Serializer):
    """One user's grant. ``can_comment`` and ``can_edit`` imply ``can_view``."""

    user_id = serializers.UUIDField()
    can_view = serializers.BooleanField(default=True)
    can_comment = serializers.BooleanField(default=False)
    can_edit = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if attrs["can_comment"] or attrs["can_edit"]:
            attrs["can_view"] = True
        if not (attrs["can_view"] or attrs["can_comment"] or attrs["can_edit"]):
            raise serializers.ValidationError("A grant must allow at least one action. Delete it to remove access.")
        return attrs


class RestrictionSerializer(serializers.Serializer):
    is_restricted = serializers.BooleanField()


def _grant_payload(grant):
    return {
        "id": str(grant.id),
        "user_id": str(grant.user_id),
        "can_view": grant.can_view,
        "can_comment": grant.can_comment,
        "can_edit": grant.can_edit,
    }


class _ResourceAccessEndpoint(BaseAPIView):
    """Shared behaviour. Subclasses set the model and the URL kwarg naming the resource."""

    resource_model = None  # Module | Issue
    resource_kwarg = None  # "module_id" | "issue_id"
    grant_field = None  # "module" | "issue"

    def _resource(self, slug, project_id, kwargs):
        return self.resource_model.objects.get(
            pk=kwargs[self.resource_kwarg], project_id=project_id, workspace__slug=slug
        )

    def _grants(self, resource):
        return ResourceAccess.objects.filter(**{self.grant_field: resource}).order_by("created_at")

    def _state(self, resource):
        return {
            "is_restricted": resource.is_restricted,
            "grants": [_grant_payload(g) for g in self._grants(resource)],
        }

    @allow_permission([ROLE.ADMIN])
    def get(self, request, slug, project_id, **kwargs):
        return Response(self._state(self._resource(slug, project_id, kwargs)), status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def patch(self, request, slug, project_id, **kwargs):
        resource = self._resource(slug, project_id, kwargs)
        serializer = RestrictionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # queryset.update(): skips Issue.save()'s heavy logic, so stamp the audit fields by hand
        self.resource_model.objects.filter(pk=resource.pk).update(
            is_restricted=serializer.validated_data["is_restricted"],
            updated_at=timezone.now(),
            updated_by=request.user,
        )
        resource.refresh_from_db()
        return Response(self._state(resource), status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def post(self, request, slug, project_id, **kwargs):
        resource = self._resource(slug, project_id, kwargs)
        serializer = ResourceAccessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Grants narrow access among people who already belong to the project
        if not ProjectMember.objects.filter(
            project_id=project_id, workspace__slug=slug, member_id=data["user_id"], is_active=True
        ).exists():
            return Response(
                {"error": "The user is not an active member of this project"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        flags = {key: data[key] for key in ("can_view", "can_comment", "can_edit")}
        grant = self._grants(resource).filter(user_id=data["user_id"]).first()
        created = grant is None
        if created:
            grant = ResourceAccess(project=resource.project, user_id=data["user_id"], **{self.grant_field: resource})
        for key, value in flags.items():
            setattr(grant, key, value)
        grant.save()

        return Response(
            _grant_payload(grant),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @allow_permission([ROLE.ADMIN])
    def delete(self, request, slug, project_id, user_id, **kwargs):
        resource = self._resource(slug, project_id, kwargs)
        grant = self._grants(resource).filter(user_id=user_id).first()
        if grant is None:
            return Response({"error": "No access grant for this user"}, status=status.HTTP_404_NOT_FOUND)
        grant.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ModuleAccessEndpoint(_ResourceAccessEndpoint):
    resource_model = Module
    resource_kwarg = "module_id"
    grant_field = "module"


class IssueAccessEndpoint(_ResourceAccessEndpoint):
    resource_model = Issue
    resource_kwarg = "issue_id"
    grant_field = "issue"


class _MyAccessEndpoint(BaseAPIView):
    """What the current user may do with one module/issue, so the UI can hide actions."""

    kind = None  # "module" | "issue"
    resource_kwarg = None

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id, **kwargs):
        model = Module if self.kind == "module" else Issue
        resource = model.objects.filter(
            pk=kwargs[self.resource_kwarg], project_id=project_id, workspace__slug=slug
        ).first()
        access = effective_access(request.user, self.kind, resource.pk, project_id) if resource else None
        if access is None:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"is_restricted": resource.is_restricted, **access}, status=status.HTTP_200_OK)


class ModuleMyAccessEndpoint(_MyAccessEndpoint):
    kind = "module"
    resource_kwarg = "module_id"


class IssueMyAccessEndpoint(_MyAccessEndpoint):
    kind = "issue"
    resource_kwarg = "issue_id"
