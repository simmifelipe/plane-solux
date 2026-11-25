# Solar: e-mails about modules ("Demandas")
#  - module marked as completed -> addresses in MODULE_COMPLETED_NOTIFY_EMAILS
#  - lead assigned to a module  -> the new lead

import logging
import os

from celery import shared_task
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import render_to_string

from plane.db.models import Module, ModuleMember, User
from plane.license.utils.instance_value import get_email_configuration
from plane.utils.email import generate_plain_text_from_html
from plane.utils.exception_logger import log_exception


def _send(subject, template, context, to):
    (host, user, password, port, use_tls, use_ssl, email_from) = get_email_configuration()
    html_content = render_to_string(template, context)
    text_content = generate_plain_text_from_html(html_content)
    connection = get_connection(
        host=host,
        port=int(port),
        username=user,
        password=password,
        use_tls=use_tls == "1",
        use_ssl=use_ssl == "1",
    )
    msg = EmailMultiAlternatives(
        subject=subject, body=text_content, from_email=email_from, to=to, connection=connection
    )
    msg.attach_alternative(html_content, "text/html")
    msg.send()


def _context(module, actor, origin):
    return {
        "module_name": module.name,
        "project_name": module.project.name,
        "workspace_name": module.workspace.name,
        "actor_name": (actor.display_name or actor.email) if actor else "",
        "module_url": f"{origin}/{module.workspace.slug}/projects/{module.project_id}/modules/{module.id}",
    }


@shared_task
def module_completed_email(module_id, actor_id, origin):
    try:
        recipients = [e.strip() for e in os.environ.get("MODULE_COMPLETED_NOTIFY_EMAILS", "").split(",") if e.strip()]
        if not recipients:
            return
        module = Module.objects.select_related("project", "workspace").get(pk=module_id)
        actor = User.objects.filter(pk=actor_id).first()
        _send(
            f"Demanda concluída: {module.name}",
            "emails/notifications/module_completed.html",
            _context(module, actor, origin),
            recipients,
        )
        logging.getLogger("plane.worker").info("Module completed email sent.")
    except Exception as e:
        log_exception(e)


ROLE_LABELS = {"lead": "responsável", "member": "membro"}


@shared_task
def module_assigned_email(module_id, user_id, role, actor_id, origin):
    """E-mail a user who was just made lead ("lead") or member ("member") of a module."""
    try:
        if str(user_id) == str(actor_id):
            return  # assigning yourself needs no e-mail
        user = User.objects.filter(pk=user_id, is_active=True).first()
        if user is None or not user.email:
            return
        module = Module.objects.select_related("project", "workspace").get(pk=module_id)
        actor = User.objects.filter(pk=actor_id).first()
        context = _context(module, actor, origin)
        context["lead_name"] = user.first_name or user.display_name or user.email
        context["role"] = role
        context["role_label"] = ROLE_LABELS.get(role, role)
        subject = (
            f"Você é o responsável pela demanda: {module.name}"
            if role == "lead"
            else f"Você foi adicionado à demanda: {module.name}"
        )
        _send(subject, "emails/notifications/module_lead_assigned.html", context, [user.email])
        logging.getLogger("plane.worker").info("Module %s assigned email sent.", role)
    except Exception as e:
        log_exception(e)


def notify_module_changes(module, old_status, old_lead_id, actor_id, origin, old_member_ids=None):
    """Call after a module was created/updated, with the status/lead/members it had *before* the change."""
    if module.status == "completed" and old_status != "completed":
        module_completed_email.delay(str(module.id), str(actor_id), origin)
    new_lead_id = str(module.lead_id) if module.lead_id else None
    if new_lead_id and new_lead_id != str(old_lead_id or ""):
        module_assigned_email.delay(str(module.id), new_lead_id, "lead", str(actor_id), origin)
    old_members = {str(m) for m in (old_member_ids or [])}
    current_members = {str(m) for m in ModuleMember.objects.filter(module=module).values_list("member_id", flat=True)}
    for member_id in current_members - old_members - ({new_lead_id} if new_lead_id else set()):
        module_assigned_email.delay(str(module.id), member_id, "member", str(actor_id), origin)
