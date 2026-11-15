# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.conf import settings
from django.db import models

# Module imports
from .project import ProjectBaseModel


class ResourceAccess(ProjectBaseModel):
    """Per-user access grant on a restricted module or issue.

    A grant belongs to exactly one resource (a module or an issue). Grants are
    only consulted when the resource has ``is_restricted=True``. ``can_comment``
    and ``can_edit`` imply ``can_view``, which is enforced on save.
    """

    module = models.ForeignKey(
        "db.Module",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="access_grants",
    )
    issue = models.ForeignKey(
        "db.Issue",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="access_grants",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="resource_access_grants",
    )
    can_view = models.BooleanField(default=True)
    can_comment = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Resource Access"
        verbose_name_plural = "Resource Accesses"
        db_table = "resource_accesses"
        ordering = ("-created_at",)
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(module__isnull=False, issue__isnull=True)
                    | models.Q(module__isnull=True, issue__isnull=False)
                ),
                name="resource_access_exactly_one_resource",
            ),
            models.UniqueConstraint(
                fields=["module", "user"],
                condition=models.Q(deleted_at__isnull=True, module__isnull=False),
                name="resource_access_unique_module_user_when_deleted_at_null",
            ),
            models.UniqueConstraint(
                fields=["issue", "user"],
                condition=models.Q(deleted_at__isnull=True, issue__isnull=False),
                name="resource_access_unique_issue_user_when_deleted_at_null",
            ),
        ]

    def save(self, *args, **kwargs):
        # Commenting or editing is meaningless without being able to see.
        if self.can_comment or self.can_edit:
            self.can_view = True
        super().save(*args, **kwargs)

    def __str__(self):
        target = self.module_id or self.issue_id
        return f"{self.user_id} -> {target}"
