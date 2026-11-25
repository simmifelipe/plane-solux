# Solar: e-mails about modules ("Demandas")
#  - module marked as completed -> addresses in MODULE_COMPLETED_NOTIFY_EMAILS
#  - lead assigned to a module  -> the new lead

import logging
import os

from celery import shared_task
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import render_to_string

from plane.db.models import Module, User
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


@shared_task
def module_lead_assigned_email(module_id, lead_id, actor_id, origin):
    try:
        if str(lead_id) == str(actor_id):
            return  # assigning yourself needs no e-mail
        lead = User.objects.filter(pk=lead_id, is_active=True).first()
        if lead is None or not lead.email:
            return
        module = Module.objects.select_related("project", "workspace").get(pk=module_id)
        actor = User.objects.filter(pk=actor_id).first()
        context = _context(module, actor, origin)
        context["lead_name"] = lead.first_name or lead.display_name or lead.email
        _send(
            f"Você é o responsável pela demanda: {module.name}",
            "emails/notifications/module_lead_assigned.html",
            context,
            [lead.email],
        )
        logging.getLogger("plane.worker").info("Module lead assigned email sent.")
    except Exception as e:
        log_exception(e)


def notify_module_changes(module, old_status, old_lead_id, actor_id, origin):
    """Call after a module was created/updated. `module` is the saved instance (before values passed in)."""
    if module.status == "completed" and old_status != "completed":
        module_completed_email.delay(str(module.id), str(actor_id), origin)
    if module.lead_id and str(module.lead_id) != str(old_lead_id or ""):
        module_lead_assigned_email.delay(str(module.id), str(module.lead_id), str(actor_id), origin)
