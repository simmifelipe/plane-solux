# Solar: saved views of modules ("Visualizações de Demandas")

# Django imports
from django.db import models
from django.db.models import Q

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import ModuleViewSerializer
from plane.db.models import ModuleView, Project, ProjectMember
from .. import BaseViewSet


class ModuleViewViewSet(BaseViewSet):
    serializer_class = ModuleViewSerializer
    model = ModuleView

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .filter(Q(owned_by=self.request.user) | Q(access=1))
            .select_related("project", "workspace")
            .order_by("name")
            .distinct()
        )

    def _is_restricted_guest(self, slug, project_id):
        project = Project.objects.get(id=project_id)
        return (
            ProjectMember.objects.filter(
                workspace__slug=slug,
                project_id=project_id,
                member=self.request.user,
                role=5,
                is_active=True,
            ).exists()
            and not project.guest_view_all_features
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER])
    def create(self, request, slug, project_id):
        serializer = ModuleViewSerializer(data=request.data)
        if serializer.is_valid():
            largest = ModuleView.objects.filter(project_id=project_id).aggregate(largest=models.Max("sort_order"))[
                "largest"
            ]
            serializer.save(
                project_id=project_id,
                owned_by=request.user,
                sort_order=(largest + 10000) if largest is not None else 65535,
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def list(self, request, slug, project_id):
        queryset = self.get_queryset()
        if self._is_restricted_guest(slug, project_id):
            queryset = queryset.filter(owned_by=request.user)
        return Response(ModuleViewSerializer(queryset, many=True).data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def retrieve(self, request, slug, project_id, pk):
        module_view = self.get_queryset().filter(pk=pk).first()
        if module_view is None or (
            self._is_restricted_guest(slug, project_id) and module_view.owned_by_id != request.user.id
        ):
            return Response({"error": "The required object does not exist."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ModuleViewSerializer(module_view).data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER])
    def partial_update(self, request, slug, project_id, pk):
        module_view = self.get_queryset().filter(pk=pk).first()
        if module_view is None:
            return Response({"error": "The required object does not exist."}, status=status.HTTP_404_NOT_FOUND)
        if module_view.owned_by_id != request.user.id:
            return Response(
                {"error": "Only the owner of the view can update the view"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ModuleViewSerializer(module_view, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER])
    def destroy(self, request, slug, project_id, pk):
        module_view = self.get_queryset().filter(pk=pk).first()
        if module_view is None:
            return Response({"error": "The required object does not exist."}, status=status.HTTP_404_NOT_FOUND)
        is_admin = ProjectMember.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            member=request.user,
            role=20,
            is_active=True,
        ).exists()
        if not (is_admin or module_view.owned_by_id == request.user.id):
            return Response(
                {"error": "Only admin or owner can delete the view"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        module_view.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
