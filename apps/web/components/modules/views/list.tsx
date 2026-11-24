/**
 * Solar: saved views of modules ("Visualizações de Demandas")
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { mutate } from "swr";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";
import { setToast } from "@plane/blocks/toast";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { ViewsOutline } from "@makeplane/propel/icons";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TModuleView } from "@plane/types";
// components
import { ListItem, ListLayout } from "@/components/core/list";
import { ViewListLoader } from "@/components/ui/loader/view-list-loader";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { moduleViewService } from "@/services/module-view.service";
// local imports
import { CreateUpdateModuleViewModal } from "./form-modal";
import { moduleViewKey, moduleViewsKey, useModuleViews } from "./use-module-views";

const ModuleViewListItem = observer(function ModuleViewListItem(props: {
  view: TModuleView;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { view, canEdit, onEdit, onDelete } = props;
  const { workspaceSlug, projectId } = useParams();
  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();
  const parentRef = useRef(null);

  return (
    <ListItem
      prependTitleElement={
        view?.logo_props?.in_use ? (
          <Logo logo={view.logo_props} size={16} type="lucide" />
        ) : (
          <ViewsOutline className="h-4 w-4 text-tertiary" />
        )
      }
      title={view.name}
      itemLink={`/${workspaceSlug}/projects/${projectId}/views/modules/${view.id}`}
      actionableItems={
        canEdit ? (
          <div className="flex items-center gap-2">
            <Tooltip label={t("module_view.edit")} disabled={isMobile}>
              <button type="button" className="text-13 text-secondary hover:text-primary" onClick={onEdit}>
                {t("module_view.edit")}
              </button>
            </Tooltip>
            <button type="button" className="text-13 text-danger-primary hover:underline" onClick={onDelete}>
              {t("common.delete")}
            </button>
          </div>
        ) : undefined
      }
      isMobile={isMobile}
      parentRef={parentRef}
    />
  );
});

export const ModuleViewsList = observer(function ModuleViewsList(props: {
  isCreateOpen: boolean;
  onCreateClose: () => void;
  onCreateOpen: () => void;
}) {
  const { isCreateOpen, onCreateClose, onCreateOpen } = props;
  const { workspaceSlug, projectId } = useParams();
  const slug = workspaceSlug?.toString() ?? "";
  const pid = projectId?.toString() ?? "";
  const router = useAppRouter();
  const { t } = useTranslation();
  const { allowPermissions } = useUserPermissions();
  const { data: views, isLoading } = useModuleViews(slug, pid);
  // state
  const [editing, setEditing] = useState<TModuleView | null>(null);
  const [deleting, setDeleting] = useState<TModuleView | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canCreate = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  const handleCreate = async (payload: Partial<TModuleView>) => {
    try {
      const res = await moduleViewService.create(slug, pid, payload);
      await mutate(moduleViewsKey(slug, pid));
      onCreateClose();
      setToast({ type: "success", title: t("toast.success"), message: t("module_view.created") });
      router.push(`/${slug}/projects/${pid}/views/modules/${res.id}`);
    } catch (_error) {
      setToast({ type: "error", title: t("toast.error"), message: t("module_view.failed_create") });
    }
  };

  const handleUpdate = async (payload: Partial<TModuleView>) => {
    if (!editing) return;
    try {
      await moduleViewService.update(slug, pid, editing.id, payload);
      await Promise.all([mutate(moduleViewsKey(slug, pid)), mutate(moduleViewKey(slug, pid, editing.id))]);
      setEditing(null);
      setToast({ type: "success", title: t("toast.success"), message: t("module_view.updated") });
    } catch (_error) {
      setToast({ type: "error", title: t("toast.error"), message: t("module_view.failed_update") });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await moduleViewService.remove(slug, pid, deleting.id);
      await mutate(moduleViewsKey(slug, pid));
      setDeleting(null);
      setToast({ type: "success", title: t("toast.success"), message: t("module_view.deleted") });
    } catch (_error) {
      setToast({ type: "error", title: t("toast.error"), message: t("module_view.failed_delete") });
    }
    setIsDeleting(false);
  };

  return (
    <>
      <CreateUpdateModuleViewModal isOpen={isCreateOpen} onClose={onCreateClose} onSubmit={handleCreate} />
      <CreateUpdateModuleViewModal
        data={editing}
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
      />
      <ConfirmDialog
        handleClose={() => setDeleting(null)}
        handleSubmit={handleDelete}
        isSubmitting={isDeleting}
        isOpen={!!deleting}
        title={t("module_view.delete_title")}
        content={<>{t("module_view.delete_confirm", { name: deleting?.name ?? "" })}</>}
      />
      {isLoading || !views ? (
        <ViewListLoader />
      ) : views.length === 0 ? (
        <EmptyStateDetailed
          assetKey="view"
          title={t("module_view.empty_title")}
          description={t("module_view.empty_description")}
          actions={[
            {
              label: t("module_view.add"),
              onClick: onCreateOpen,
              disabled: !canCreate,
              variant: "primary",
            },
          ]}
        />
      ) : (
        <div className="flex h-full w-full flex-col">
          <ListLayout>
            {views.map((view) => (
              <ModuleViewListItem
                key={view.id}
                view={view}
                canEdit={canCreate}
                onEdit={() => setEditing(view)}
                onDelete={() => setDeleting(view)}
              />
            ))}
          </ListLayout>
        </div>
      )}
    </>
  );
});
