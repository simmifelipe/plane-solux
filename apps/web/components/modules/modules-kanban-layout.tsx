/**
 * Solar: Kanban layout for modules ("Demandas") — one column per module status.
 * Dragging a card to another column changes the module status.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { MODULE_STATUS, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import { ModuleStatusIcon } from "@plane/blocks/icons";
import type { TModuleStatus } from "@plane/types";
import { cn } from "@plane/utils";
// hooks
import { useModule } from "@/hooks/store/use-module";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import { ModuleCardItem } from "./module-card-item";

type Props = {
  moduleIds: string[];
};

export const ModulesKanbanLayout = observer(function ModulesKanbanLayout({ moduleIds }: Props) {
  const { workspaceSlug, projectId } = useParams();
  const { t } = useTranslation();
  const { getModuleById, updateModuleDetails } = useModule();
  const { allowPermissions } = useUserPermissions();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TModuleStatus | null>(null);

  const canEdit = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  // modules without a status are shown in the backlog column
  const statusOf = (id: string): TModuleStatus => {
    const status = getModuleById(id)?.status?.toLowerCase();
    return (MODULE_STATUS.find((s) => s.value === status)?.value ?? "backlog") as TModuleStatus;
  };

  const handleDrop = async (status: TModuleStatus) => {
    const id = draggingId;
    setDraggingId(null);
    setOverStatus(null);
    if (!id || !canEdit || !workspaceSlug || !projectId || statusOf(id) === status) return;
    try {
      await updateModuleDetails(workspaceSlug.toString(), projectId.toString(), id, { status });
    } catch (err: any) {
      setToast({
        type: "error",
        title: t("toast.error"),
        message: err?.detail ?? t("ui.module_could_not_be_updated"),
      });
    }
  };

  return (
    <div className="flex size-full gap-4 overflow-x-auto px-page-x py-page-y horizontal-scrollbar scrollbar-lg">
      {MODULE_STATUS.map((status) => {
        const ids = moduleIds.filter((id) => statusOf(id) === status.value);
        const isOver = overStatus === status.value && draggingId !== null;
        return (
          <div
            key={status.value}
            className={cn(
              "flex h-full w-80 flex-shrink-0 flex-col rounded-lg bg-layer-1 transition-colors",
              isOver && "bg-layer-1-hover ring-1 ring-accent-strong"
            )}
            onDragOver={(e) => {
              if (!canEdit || !draggingId) return;
              e.preventDefault();
              setOverStatus(status.value);
            }}
            onDragLeave={() => setOverStatus((cur) => (cur === status.value ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              void handleDrop(status.value);
            }}
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <ModuleStatusIcon status={status.value} />
              <span className="text-body-xs-medium text-primary">{t(status.i18n_label)}</span>
              <span className="text-body-xs-regular text-tertiary">{ids.length}</span>
            </div>
            <div className="vertical-scrollbar scrollbar-sm flex flex-1 flex-col gap-3 overflow-y-auto px-2 pb-3">
              {ids.map((id) => (
                <div
                  key={id}
                  draggable={canEdit}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", id);
                    setDraggingId(id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverStatus(null);
                  }}
                  className={cn(draggingId === id && "opacity-50")}
                >
                  <ModuleCardItem moduleId={id} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});
