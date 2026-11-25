/**
 * Solar: saved views of modules ("Visualizações de Demandas")
 */

import { useCallback } from "react";
import { observer } from "mobx-react";
import { Tab, Tabs, TabsList } from "@makeplane/propel/components/tabs";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { MODULE_VIEW_LAYOUTS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { calculateTotalFilters } from "@plane/utils";
import type { TModuleDisplayFilters, TModuleFilters } from "@plane/types";
// components
import { ModuleAppliedFiltersList } from "@/components/modules/applied-filters";
import { ModuleLayoutIcon } from "@/components/modules/module-layout-icon";
import { ModuleOrderByDropdown } from "@/components/modules/dropdowns";
import { ModuleFiltersDropdown } from "@/components/modules/dropdowns/filters/dropdown";
// hooks
import { useMember } from "@/hooks/store/use-member";

type Props = {
  filters: TModuleFilters;
  displayFilters: TModuleDisplayFilters;
  onFiltersChange: (filters: TModuleFilters) => void;
  onDisplayFiltersChange: (displayFilters: TModuleDisplayFilters) => void;
  showApplied?: boolean;
};

/** Filters + order-by controls (and the chips of applied filters) bound to plain values, not to the global store. */
export const ModuleViewFiltersControls = observer(function ModuleViewFiltersControls(props: Props) {
  const { filters, displayFilters, onFiltersChange, onDisplayFiltersChange } = props;
  const { t } = useTranslation();
  const {
    workspace: { workspaceMemberIds },
  } = useMember();

  const handleFilters = useCallback(
    (key: keyof TModuleFilters, value: string | string[]) => {
      const current = [...(filters?.[key] ?? [])];
      const values = Array.isArray(value) ? value : [value];
      values.forEach((val) => {
        const index = current.indexOf(val);
        if (index === -1) current.push(val);
        else current.splice(index, 1);
      });
      onFiltersChange({ ...filters, [key]: current });
    },
    [filters, onFiltersChange]
  );

  const isFiltersApplied = calculateTotalFilters(filters ?? {}) !== 0 || !!displayFilters?.favorites;

  return (
    <div className="flex items-center gap-2">
      {/* layout (the timeline layout is not available for saved views) */}
      <Tabs value={displayFilters?.layout ?? "list"} variant="contained" stretch="auto">
        <TabsList aria-label={t("common.layout")}>
          {MODULE_VIEW_LAYOUTS.filter((layout) => layout.key !== "gantt").map((layout) => (
            <Tooltip key={layout.key} label={t(layout.i18n_title)}>
              <Tab
                value={layout.key}
                label=""
                aria-label={t(layout.i18n_title)}
                icon={<ModuleLayoutIcon layoutType={layout.key} size={16} />}
                onClick={() => onDisplayFiltersChange({ ...displayFilters, layout: layout.key })}
              />
            </Tooltip>
          ))}
        </TabsList>
      </Tabs>
      <ModuleFiltersDropdown
        isFiltersApplied={isFiltersApplied}
        displayFilters={displayFilters ?? {}}
        filters={filters ?? {}}
        handleDisplayFiltersUpdate={(val) => onDisplayFiltersChange({ ...displayFilters, ...val })}
        handleFiltersUpdate={handleFilters}
        memberIds={workspaceMemberIds ?? undefined}
      />
      <ModuleOrderByDropdown
        value={displayFilters?.order_by}
        onChange={(val) => onDisplayFiltersChange({ ...displayFilters, order_by: val })}
      />
    </div>
  );
});

export const ModuleViewAppliedFilters = observer(function ModuleViewAppliedFilters(props: Props) {
  const { filters, displayFilters, onFiltersChange, onDisplayFiltersChange } = props;
  const isFiltersApplied = calculateTotalFilters(filters ?? {}) !== 0 || !!displayFilters?.favorites;
  if (!isFiltersApplied) return null;
  return (
    <ModuleAppliedFiltersList
      appliedFilters={filters ?? {}}
      isFavoriteFilterApplied={!!displayFilters?.favorites}
      handleClearAllFilters={() => {
        onFiltersChange({});
        onDisplayFiltersChange({ ...displayFilters, favorites: false });
      }}
      handleRemoveFilter={(key, value) => {
        const next = value ? (filters?.[key] ?? []).filter((val) => val !== value) : [];
        onFiltersChange({ ...filters, [key]: next });
      }}
      handleDisplayFiltersUpdate={(val) => onDisplayFiltersChange({ ...displayFilters, ...val })}
      alwaysAllowEditing
    />
  );
});
