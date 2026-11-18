# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third Party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer, DynamicBaseSerializer
from .project import ProjectLiteSerializer

# Django imports
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError

from plane.db.models import (
    User,
    Label,
    Module,
    ModuleMember,
    ModuleIssue,
    ModuleLink,
    ModuleUserProperties,
    ModuleComment,
)
from .user import UserLiteSerializer
from plane.utils.content_validator import validate_html_content


class ModuleWriteSerializer(BaseSerializer):
    lead_id = serializers.PrimaryKeyRelatedField(
        source="lead", queryset=User.objects.all(), required=False, allow_null=True
    )
    member_ids = serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=User.objects.all()),
        write_only=True,
        required=False,
    )

    class Meta:
        model = Module
        fields = "__all__"
        read_only_fields = [
            "is_restricted",
            "workspace",
            "project",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "archived_at",
            "deleted_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["member_ids"] = [str(member.id) for member in instance.members.all()]
        return data

    def validate(self, data):
        if (
            data.get("start_date", None) is not None
            and data.get("target_date", None) is not None
            and data.get("start_date", None) > data.get("target_date", None)
        ):
            raise serializers.ValidationError("Start date cannot exceed target date")
        # Solar: only labels of the module's project, without duplicates
        label_ids = data.get("label_ids", None)
        if label_ids is not None:
            project = self.instance.project if self.instance else self.context.get("project")
            unique_ids = list(dict.fromkeys(label_ids))
            valid_ids = set(
                Label.objects.filter(project=project, id__in=unique_ids, deleted_at__isnull=True).values_list(
                    "id", flat=True
                )
            )
            data["label_ids"] = [label_id for label_id in unique_ids if label_id in valid_ids]
        # Solar: the estimate point must belong to the module's project
        estimate_point = data.get("estimate_point", None)
        if estimate_point is not None:
            project = self.instance.project if self.instance else self.context.get("project")
            if project is None or estimate_point.project_id != project.id:
                raise serializers.ValidationError({"estimate_point": "Invalid estimate point"})
        # Solar: priority, labels and (when the project uses estimates) estimate are required on creation
        if self.instance is None:
            project = self.context.get("project")
            errors = {}
            if data.get("priority", "none") in (None, "", "none"):
                errors["priority"] = "Priority is required"
            if not data.get("label_ids"):
                errors["label_ids"] = "At least one label is required"
            if project is not None and project.estimate_id and data.get("estimate_point") is None:
                errors["estimate_point"] = "Estimate is required"
            if errors:
                raise serializers.ValidationError(errors)
        return data

    def create(self, validated_data):
        members = validated_data.pop("member_ids", None)
        project = self.context["project"]

        module_name = validated_data.get("name")
        if module_name:
            # Lookup for the module name in the module table for that project
            if Module.objects.filter(name=module_name, project=project).exists():
                raise serializers.ValidationError({"error": "Module with this name already exists"})

        module = Module.objects.create(**validated_data, project=project)
        if members is not None:
            ModuleMember.objects.bulk_create(
                [
                    ModuleMember(
                        module=module,
                        member=member,
                        project=project,
                        workspace=project.workspace,
                        created_by=module.created_by,
                        updated_by=module.updated_by,
                    )
                    for member in members
                ],
                batch_size=10,
                ignore_conflicts=True,
            )

        return module

    def update(self, instance, validated_data):
        members = validated_data.pop("member_ids", None)
        module_name = validated_data.get("name")
        if module_name:
            # Lookup for the module name in the module table for that project
            if Module.objects.filter(name=module_name, project=instance.project).exclude(id=instance.id).exists():
                raise serializers.ValidationError({"error": "Module with this name already exists"})

        if members is not None:
            ModuleMember.objects.filter(module=instance).delete()
            ModuleMember.objects.bulk_create(
                [
                    ModuleMember(
                        module=instance,
                        member=member,
                        project=instance.project,
                        workspace=instance.project.workspace,
                        created_by=instance.created_by,
                        updated_by=instance.updated_by,
                    )
                    for member in members
                ],
                batch_size=10,
                ignore_conflicts=True,
            )

        return super().update(instance, validated_data)


class ModuleFlatSerializer(BaseSerializer):
    class Meta:
        model = Module
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]


class ModuleIssueSerializer(BaseSerializer):
    module_detail = ModuleFlatSerializer(read_only=True, source="module")
    issue_detail = ProjectLiteSerializer(read_only=True, source="issue")
    sub_issues_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ModuleIssue
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "module",
        ]


class ModuleLinkSerializer(BaseSerializer):
    class Meta:
        model = ModuleLink
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "module",
        ]

    def to_internal_value(self, data):
        # Modify the URL before validation by appending http:// if missing
        url = data.get("url", "")
        if url and not url.startswith(("http://", "https://")):
            data["url"] = "http://" + url

        return super().to_internal_value(data)

    def validate_url(self, value):
        # Use Django's built-in URLValidator for validation
        url_validator = URLValidator()
        try:
            url_validator(value)
        except ValidationError:
            raise serializers.ValidationError({"error": "Invalid URL format."})

        return value

    def create(self, validated_data):
        validated_data["url"] = self.validate_url(validated_data.get("url"))
        if ModuleLink.objects.filter(url=validated_data.get("url"), module_id=validated_data.get("module_id")).exists():
            raise serializers.ValidationError({"error": "URL already exists."})
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data["url"] = self.validate_url(validated_data.get("url"))
        if (
            ModuleLink.objects.filter(url=validated_data.get("url"), module_id=instance.module_id)
            .exclude(pk=instance.id)
            .exists()
        ):
            raise serializers.ValidationError({"error": "URL already exists for this Issue"})

        return super().update(instance, validated_data)


class ModuleSerializer(DynamicBaseSerializer):
    member_ids = serializers.ListField(child=serializers.UUIDField(), required=False, allow_null=True)
    is_favorite = serializers.BooleanField(read_only=True)
    total_issues = serializers.IntegerField(read_only=True)
    cancelled_issues = serializers.IntegerField(read_only=True)
    completed_issues = serializers.IntegerField(read_only=True)
    started_issues = serializers.IntegerField(read_only=True)
    unstarted_issues = serializers.IntegerField(read_only=True)
    backlog_issues = serializers.IntegerField(read_only=True)
    total_estimate_points = serializers.FloatField(read_only=True)
    completed_estimate_points = serializers.FloatField(read_only=True)
    # Annotated by the module viewset; absent (and skipped) elsewhere
    can_comment = serializers.BooleanField(read_only=True)
    can_edit = serializers.BooleanField(read_only=True)

    class Meta:
        model = Module
        fields = [
            # Required fields
            "id",
            "workspace_id",
            "project_id",
            # Model fields
            "name",
            "description",
            "description_text",
            "description_html",
            "start_date",
            "target_date",
            "status",
            "priority",
            "label_ids",
            "estimate_point",
            "lead_id",
            "member_ids",
            "view_props",
            "sort_order",
            "external_source",
            "external_id",
            "logo_props",
            "is_restricted",
            # computed fields
            "can_comment",
            "can_edit",
            "total_estimate_points",
            "completed_estimate_points",
            "is_favorite",
            "total_issues",
            "cancelled_issues",
            "completed_issues",
            "started_issues",
            "unstarted_issues",
            "backlog_issues",
            "created_at",
            "updated_at",
            "archived_at",
        ]
        read_only_fields = fields


class ModuleDetailSerializer(ModuleSerializer):
    link_module = ModuleLinkSerializer(read_only=True, many=True)
    sub_issues = serializers.IntegerField(read_only=True)
    backlog_estimate_points = serializers.FloatField(read_only=True)
    unstarted_estimate_points = serializers.FloatField(read_only=True)
    started_estimate_points = serializers.FloatField(read_only=True)
    cancelled_estimate_points = serializers.FloatField(read_only=True)

    class Meta(ModuleSerializer.Meta):
        fields = ModuleSerializer.Meta.fields + [
            "link_module",
            "sub_issues",
            "backlog_estimate_points",
            "unstarted_estimate_points",
            "started_estimate_points",
            "cancelled_estimate_points",
        ]


class ModuleUserPropertiesSerializer(BaseSerializer):
    class Meta:
        model = ModuleUserProperties
        fields = "__all__"
        read_only_fields = ["workspace", "project", "module", "user"]


class ModuleCommentSerializer(BaseSerializer):
    """Solar: comments on a "Demanda" (module)."""

    actor_detail = UserLiteSerializer(read_only=True, source="actor")
    comment_reactions = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()

    class Meta:
        model = ModuleComment
        fields = [
            "id",
            "workspace",
            "project",
            "module",
            "actor",
            "actor_detail",
            "comment_html",
            "comment_stripped",
            "comment_json",
            "comment_reactions",
            "attachments",
            "edited_at",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "project",
            "module",
            "actor",
            "comment_stripped",
            "edited_at",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]

    def get_comment_reactions(self, obj):
        return [
            {"id": str(r.id), "actor": str(r.actor_id), "reaction": r.reaction, "comment": str(r.comment_id)}
            for r in obj.module_comment_reactions.all()
        ]

    def get_attachments(self, obj):
        return []

    def validate(self, attrs):
        if "comment_html" in attrs and attrs["comment_html"]:
            is_valid, _, sanitized_html = validate_html_content(attrs["comment_html"])
            if not is_valid:
                raise serializers.ValidationError({"comment_html": "HTML content is not valid"})
            if sanitized_html is not None:
                attrs["comment_html"] = sanitized_html
        return attrs
