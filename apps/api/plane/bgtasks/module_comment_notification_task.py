# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Solar: in-app notifications for comments on a "Demanda" (module)

# Third party imports
from celery import shared_task

# Module imports
from plane.bgtasks.notification_task import extract_comment_mentions
from plane.db.models import ModuleComment, ModuleMember, Notification, ProjectMember
from plane.utils.exception_logger import log_exception
from plane.utils.resource_access import can_access_module


@shared_task
def module_comment_notifications(comment_id, actor_id, old_comment_html=None):
    try:
        comment = ModuleComment.objects.select_related("module", "project", "workspace").filter(pk=comment_id).first()
        if comment is None:
            return
        module = comment.module
        project = comment.project

        mentioned = set(extract_comment_mentions(comment.comment_html))
        if old_comment_html is not None:
            # Edit: only users newly @mentioned are notified
            mentioned -= set(extract_comment_mentions(old_comment_html))
            followers = set()
        else:
            followers = set()
            if module.lead_id:
                followers.add(str(module.lead_id))
            if module.created_by_id:
                followers.add(str(module.created_by_id))
            followers |= {
                str(uid) for uid in ModuleMember.objects.filter(module=module).values_list("member_id", flat=True)
            }
            followers |= {
                str(uid)
                for uid in ModuleComment.objects.filter(module=module)
                .exclude(pk=comment.pk)
                .values_list("actor_id", flat=True)
                if uid
            }

        recipients = (mentioned | followers) - {str(actor_id)}
        if not recipients:
            return

        # Only active project members who can still see the module
        active_members = {
            str(uid)
            for uid in ProjectMember.objects.filter(
                project=project, member_id__in=recipients, is_active=True
            ).values_list("member_id", flat=True)
        }

        text = (comment.comment_stripped or "").strip()
        if len(text) > 200:
            text = text[:200] + "…"

        notifications = []
        for receiver_id in active_members:
            from plane.db.models import User

            receiver = User.objects.filter(pk=receiver_id).first()
            if receiver is None or not can_access_module(receiver, module.id):
                continue
            is_mention = receiver_id in mentioned
            notifications.append(
                Notification(
                    workspace=comment.workspace,
                    project=project,
                    sender="in_app:module_comment:" + ("mentioned" if is_mention else "commented"),
                    triggered_by_id=actor_id,
                    receiver_id=receiver_id,
                    entity_identifier=module.id,
                    entity_name="module",
                    title=module.name,
                    message_html=comment.comment_html,
                    message_stripped=text,
                    data={
                        "module": {
                            "id": str(module.id),
                            "name": module.name,
                            "project_id": str(project.id),
                            "project_identifier": project.identifier,
                        },
                        "module_comment": {
                            "id": str(comment.id),
                            "text": text,
                            "mentioned": is_mention,
                        },
                    },
                )
            )
        Notification.objects.bulk_create(notifications, batch_size=100)
    except Exception as e:
        log_exception(e)
