# Solar: business rules for modules ("Demandas")

from plane.db.models import Issue, Module
from plane.db.models.state import StateGroup

COMPLETED = "completed"

ERR_OPEN_TASKS = "Não é possível concluir a demanda: ainda há tarefas não concluídas."
ERR_COMPLETED_MODULE = (
    "Não é possível adicionar tarefas a uma demanda concluída. Volte a demanda para 'Em andamento' antes de adicionar."
)


def module_open_task_count(module_id):
    """Tasks of the module that are neither completed nor cancelled (archived/deleted/draft tasks are ignored)."""
    return (
        Issue.issue_objects.filter(issue_module__module_id=module_id, issue_module__deleted_at__isnull=True)
        .exclude(state__group__in=[StateGroup.COMPLETED.value, StateGroup.CANCELLED.value])
        .distinct()
        .count()
    )


def completion_blocked(module, new_status):
    """True when the request would move `module` into 'completed' while it still has open tasks."""
    if new_status != COMPLETED or module.status == COMPLETED:
        return False
    return module_open_task_count(module.id) > 0


def completed_modules(module_ids):
    """Subset of `module_ids` whose status is 'completed'."""
    if not module_ids:
        return []
    return list(Module.objects.filter(pk__in=module_ids, status=COMPLETED).values_list("id", flat=True))
