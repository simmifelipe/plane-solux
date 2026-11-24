# Solar: saved views of modules ("Visualizações de Demandas")

# Module imports
from .base import DynamicBaseSerializer
from plane.db.models import ModuleView


class ModuleViewSerializer(DynamicBaseSerializer):
    class Meta:
        model = ModuleView
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
            "owned_by",
            "created_by",
            "updated_by",
        ]
