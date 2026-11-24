/**
 * Solar: saved views of modules ("Visualizações de Demandas")
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { mutate } from "swr";
import { setToast } from "@plane/blocks/toast";
import { Button } from "@makeplane/propel/components/button";
import { ExpandableSearch } from "@makeplane/propel/components/expandable-search";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TModuleDisplayFilters, TModuleFilters } from "@plane/types";
// components
import { PageHead } from "@/components/core/page-title";
import {
  ModuleViewAppliedFilters,
  ModuleViewFiltersControls,
  ModuleViewModules,
  moduleViewKey,
  moduleViewsKey,
  useModuleView,
} from "@/components/modules/views";
// hooks
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { moduleViewService } from "@/services/module-view.service";
import type { Route } from "./+types/page";

function ModuleViewDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId, viewId } = params;
  const { t } = useTranslation();
  const { data: currentUser } = useUser();
  const { allowPermissions } = useUserPermissions();
  const { data: view, error } = useModuleView(workspaceSlug, projectId, viewId);
  // local (unsaved) edits
  const [filters, setFilters] = useState<TModuleFilters>({});
  const [displayFilters, setDisplayFilters] = useState<TModuleDisplayFilters>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!view) return;
    setFilters(view.filters ?? {});
    setDisplayFilters(view.display_filters ?? {});
  }, [view]);

  if (error)
    return <div className="flex h-full w-full items-center justify-center text-secondary">{t("module_view.not_found")}</div>;
  if (!view) return null;

  const isOwner = view.owned_by === currentUser?.id;
  const canEdit =
    isOwner && allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT);
  const isDirty =
    JSON.stringify(filters) !== JSON.stringify(view.filters ?? {}) ||
    JSON.stringify(displayFilters) !== JSON.stringify(view.display_filters ?? {});

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await moduleViewService.update(workspaceSlug, projectId, viewId, { filters, display_filters: displayFilters });
      await Promise.all([mutate(moduleViewKey(workspaceSlug, projectId, viewId)), mutate(moduleViewsKey(workspaceSlug, projectId))]);
      setToast({ type: "success", title: t("toast.success"), message: t("module_view.updated") });
    } catch (_error) {
      setToast({ type: "error", title: t("toast.error"), message: t("module_view.failed_update") });
    }
    setIsSaving(false);
  };

  const effectiveView = { ...view, filters, display_filters: displayFilters };

  return (
    <>
      <PageHead title={view.name} />
      <div className="flex h-full w-full flex-col">
        <div className="flex items-center justify-between gap-2 px-page-x py-2">
          <div className="flex items-center gap-2">
            <ModuleViewFiltersControls
              filters={filters}
              displayFilters={displayFilters}
              onFiltersChange={setFilters}
              onDisplayFiltersChange={setDisplayFilters}
            />
            <ExpandableSearch
              size="md"
              aria-label={t("common.search.label")}
              clearLabel={t("common.clear")}
              placeholder={t("common.search.label")}
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
          </div>
          {canEdit && isDirty && (
            <Button
              variant="primary"
              size="md"
              stretch="auto"
              label={t("module_view.save_changes")}
              loading={isSaving}
              onClick={handleSave}
            />
          )}
        </div>
        <ModuleViewAppliedFilters
          filters={filters}
          displayFilters={displayFilters}
          onFiltersChange={setFilters}
          onDisplayFiltersChange={setDisplayFilters}
        />
        <ModuleViewModules view={effectiveView} searchQuery={searchQuery} />
      </div>
    </>
  );
}

export default observer(ModuleViewDetailPage);
