# Solar: file attachments of a "Demanda" (module).
# Same direct-to-storage flow as work item attachments: POST returns a presigned upload,
# the client uploads, then PATCH confirms. entity_identifier holds the module id.

import uuid

from django.conf import settings
from django.http import HttpResponseRedirect
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import IssueAttachmentSerializer
from plane.bgtasks.storage_metadata_task import get_asset_object_metadata
from plane.db.models import FileAsset, Module, ProjectMember, Workspace
from plane.settings.storage import S3Storage
from plane.utils.attachment_types import is_blocked_attachment
from plane.utils.path_validator import sanitize_filename
from plane.utils.resource_access import AccessAction, accessible_modules
from .. import BaseAPIView


class ModuleAttachmentV2Endpoint(BaseAPIView):
    serializer_class = IssueAttachmentSerializer
    model = FileAsset

    def _module(self, request, slug, project_id, module_id, action):
        return (
            accessible_modules(
                Module.objects.filter(pk=module_id, project_id=project_id, workspace__slug=slug),
                request.user,
                action,
            )
            .select_related("workspace")
            .first()
        )

    def _not_found(self):
        return Response({"error": "The required object does not exist."}, status=status.HTTP_404_NOT_FOUND)

    def _assets(self, slug, project_id, module_id):
        return FileAsset.objects.filter(
            entity_type=FileAsset.EntityTypeContext.MODULE_ATTACHMENT,
            entity_identifier=str(module_id),
            workspace__slug=slug,
            project_id=project_id,
            is_deleted=False,
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id, module_id):
        module = self._module(request, slug, project_id, module_id, AccessAction.EDIT)
        if module is None:
            return self._not_found()
        if module.archived_at:
            return Response({"error": "Archived module cannot be updated"}, status=status.HTTP_400_BAD_REQUEST)

        name = sanitize_filename(request.data.get("name")) or "unnamed"
        file_type = request.data.get("type") or "application/octet-stream"
        try:
            size = int(request.data.get("size", settings.FILE_SIZE_LIMIT))
        except (TypeError, ValueError):
            size = settings.FILE_SIZE_LIMIT

        if is_blocked_attachment(name, file_type):
            return Response(
                {"error": "Este tipo de arquivo não é permitido (executáveis e scripts).", "status": False},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if size > settings.FILE_SIZE_LIMIT:
            return Response(
                {"error": "O arquivo excede o tamanho máximo permitido.", "status": False},
                status=status.HTTP_400_BAD_REQUEST,
            )

        workspace = Workspace.objects.get(slug=slug)
        asset_key = f"{workspace.id}/{uuid.uuid4().hex}-{name}"
        asset = FileAsset.objects.create(
            attributes={"name": name, "type": file_type, "size": size},
            asset=asset_key,
            size=size,
            workspace_id=workspace.id,
            created_by=request.user,
            project_id=project_id,
            entity_type=FileAsset.EntityTypeContext.MODULE_ATTACHMENT,
            entity_identifier=str(module_id),
        )
        storage = S3Storage(request=request)
        presigned_url = storage.generate_presigned_post(object_name=asset_key, file_type=file_type, file_size=size)
        return Response(
            {
                "upload_data": presigned_url,
                "asset_id": str(asset.id),
                "attachment": IssueAttachmentSerializer(asset).data,
                "asset_url": asset.asset_url,
            },
            status=status.HTTP_200_OK,
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id, module_id, pk=None):
        if self._module(request, slug, project_id, module_id, AccessAction.VIEW) is None:
            return self._not_found()
        if pk:
            asset = self._assets(slug, project_id, module_id).filter(pk=pk).first()
            if asset is None:
                return self._not_found()
            if not asset.is_uploaded:
                return Response(
                    {"error": "The asset is not uploaded.", "status": False}, status=status.HTTP_400_BAD_REQUEST
                )
            storage = S3Storage(request=request)
            # ?inline=1 lets the UI preview images; the storage layer still serves anything
            # outside INLINE_SAFE_MIME_TYPES (SVG, HTML, PDF, ...) as a download.
            inline = request.GET.get("inline") == "1"
            presigned_url = storage.generate_presigned_url(
                object_name=asset.asset.name,
                disposition="inline" if inline else "attachment",
                filename=asset.attributes.get("name"),
                content_type=asset.attributes.get("type") if inline else None,
            )
            return HttpResponseRedirect(presigned_url)
        attachments = self._assets(slug, project_id, module_id).filter(is_uploaded=True).order_by("-created_at")
        return Response(IssueAttachmentSerializer(attachments, many=True).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def patch(self, request, slug, project_id, module_id, pk):
        if self._module(request, slug, project_id, module_id, AccessAction.EDIT) is None:
            return self._not_found()
        asset = self._assets(slug, project_id, module_id).filter(pk=pk).first()
        if asset is None:
            return self._not_found()
        asset.is_uploaded = True
        if not asset.storage_metadata:
            get_asset_object_metadata.delay(str(asset.id))
        asset.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def delete(self, request, slug, project_id, module_id, pk):
        if self._module(request, slug, project_id, module_id, AccessAction.EDIT) is None:
            return self._not_found()
        asset = self._assets(slug, project_id, module_id).filter(pk=pk).first()
        if asset is None:
            return self._not_found()
        is_admin = ProjectMember.objects.filter(
            workspace__slug=slug, project_id=project_id, member=request.user, role=ROLE.ADMIN.value, is_active=True
        ).exists()
        if not (is_admin or asset.created_by_id == request.user.id):
            return Response(
                {"error": "Somente o autor do anexo ou um admin pode excluí-lo."},
                status=status.HTTP_403_FORBIDDEN,
            )
        asset.is_deleted = True
        asset.deleted_at = timezone.now()
        asset.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
