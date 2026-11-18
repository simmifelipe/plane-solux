# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Solar: comments on a "Demanda" (module)

# Django imports
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ProjectLitePermission, allow_permission, ROLE
from plane.app.serializers import ModuleCommentSerializer
from plane.db.models import Module, ModuleComment
from plane.utils.resource_access import AccessAction, is_project_admin
from .. import BaseViewSet


class ModuleCommentViewSet(BaseViewSet):
    # Writes need the "comment" grant on restricted modules (checked by ResourceAccessMixin via module_id)
    access_write_action = AccessAction.COMMENT
    permission_classes = [ProjectLitePermission]
    serializer_class = ModuleCommentSerializer
    model = ModuleComment

    def get_queryset(self):
        return (
            ModuleComment.objects.filter(
                workspace__slug=self.kwargs.get("slug"),
                project_id=self.kwargs.get("project_id"),
                module_id=self.kwargs.get("module_id"),
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .select_related("actor")
            .order_by("created_at")
            .distinct()
        )

    def _get_module(self, slug, project_id, module_id):
        return Module.objects.filter(pk=module_id, project_id=project_id, workspace__slug=slug).first()

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def list(self, request, slug, project_id, module_id):
        if self._get_module(slug, project_id, module_id) is None:
            return Response({"error": "Module not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = ModuleCommentSerializer(self.get_queryset(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def create(self, request, slug, project_id, module_id):
        module = self._get_module(slug, project_id, module_id)
        if module is None:
            return Response({"error": "Module not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = ModuleCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(module=module, project_id=project_id, actor=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def partial_update(self, request, slug, project_id, module_id, pk):
        comment = self.get_queryset().filter(pk=pk).first()
        if comment is None:
            return Response({"error": "Comment not found"}, status=status.HTTP_404_NOT_FOUND)
        if comment.actor_id != request.user.id:
            return Response(
                {"error": "Only the author can edit this comment"},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = ModuleCommentSerializer(comment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(edited_at=timezone.now())
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def destroy(self, request, slug, project_id, module_id, pk):
        comment = self.get_queryset().filter(pk=pk).first()
        if comment is None:
            return Response({"error": "Comment not found"}, status=status.HTTP_404_NOT_FOUND)
        if comment.actor_id != request.user.id and not is_project_admin(request.user, project_id):
            return Response(
                {"error": "Only the author or a project admin can delete this comment"},
                status=status.HTTP_403_FORBIDDEN,
            )
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
