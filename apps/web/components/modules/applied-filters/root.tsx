/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { CloseOutline } from "@makeplane/propel/icons";
import type { TModuleDisplayFilters, TModuleFilters } from "@plane/types";
// components
import { Header, EHeaderVariant } from "@plane/blocks/layout";
import { replaceUnderscoreIfSnakeCase } from "@plane/utils";
import {
  AppliedDateFilters,
  AppliedMembersFilters,
  AppliedPriorityFilters,
  AppliedStatusFilters,
} from "@/components/modules";
import { APPLIED_FILTER_GROUP_CLASSNAME, RemovableChip } from "@/components/common/removable-chip";
// helpers
// types

type Props = {
  appliedFilters: TModuleFilters;
  isFavoriteFilterApplied?: boolean;
  handleClearAllFilters: () => void;
  handleDisplayFiltersUpdate?: (updatedDisplayProperties: Partial<TModuleDisplayFilters>) => void;
  handleRemoveFilter: (key: keyof TModuleFilters, value: string | null) => void;
  alwaysAllowEditing?: boolean;
  isArchived?: boolean;
};

const MEMBERS_FILTERS = new Set(["lead", "members"]);
const DATE_FILTERS = new Set(["start_date", "target_date"]);

export function ModuleAppliedFiltersList(props: Props) {
  const {
    appliedFilters,
    isFavoriteFilterApplied,
    handleClearAllFilters,
    handleRemoveFilter,
    handleDisplayFiltersUpdate,
    alwaysAllowEditing,
    isArchived = false,
  } = props;
  const { t } = useTranslation();

  if (!appliedFilters && !isFavoriteFilterApplied) return null;
  if (Object.keys(appliedFilters).length === 0 && !isFavoriteFilterApplied) return null;

  const isEditingAllowed = alwaysAllowEditing;

  // Solar: translated filter group labels
  const FILTER_LABELS: Partial<Record<keyof TModuleFilters, string>> = {
    status: t("common.status"),
    priority: t("common.priority"),
    lead: t("lead"),
    members: t("members"),
    start_date: t("start_date"),
    target_date: t("end_date"),
  };
  const getFilterLabel = (key: keyof TModuleFilters) => FILTER_LABELS[key] ?? replaceUnderscoreIfSnakeCase(key);

  return (
    <Header variant={EHeaderVariant.TERNARY}>
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(appliedFilters).map(([key, value]) => {
          const filterKey = key as keyof TModuleFilters;

          if (!value) return;
          if (Array.isArray(value) && value.length === 0) return;

          return (
            <div key={filterKey} className={APPLIED_FILTER_GROUP_CLASSNAME}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-caption-sm-regular text-tertiary capitalize">
                  {getFilterLabel(filterKey)}
                </span>
                {filterKey === "status" && (
                  <AppliedStatusFilters
                    editable={isEditingAllowed}
                    handleRemove={(val) => handleRemoveFilter("status", val)}
                    values={value}
                  />
                )}
                {filterKey === "priority" && (
                  <AppliedPriorityFilters
                    editable={isEditingAllowed}
                    handleRemove={(val) => handleRemoveFilter("priority", val)}
                    values={value}
                  />
                )}
                {DATE_FILTERS.has(filterKey) && (
                  <AppliedDateFilters
                    editable={isEditingAllowed}
                    handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                    values={value}
                  />
                )}
                {MEMBERS_FILTERS.has(filterKey) && (
                  <AppliedMembersFilters
                    editable={isEditingAllowed}
                    handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                    values={value}
                  />
                )}
                {isEditingAllowed && (
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label={`${t("aria_labels.common.remove")}: ${getFilterLabel(filterKey)}`}
                    onClick={() => handleRemoveFilter(filterKey, null)}
                    icon={<Icon icon={CloseOutline} />}
                  />
                )}
              </div>
            </div>
          );
        })}
        {!isArchived && isFavoriteFilterApplied && (
          <div key="module_display_filters" className={APPLIED_FILTER_GROUP_CLASSNAME}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-caption-sm-regular text-tertiary capitalize">{t("modules")}</span>
              <RemovableChip
                variant="soft"
                label={t("ui.favorite")}
                ariaLabel={t("ui.favorite")}
                onRemove={
                  isEditingAllowed
                    ? () =>
                        handleDisplayFiltersUpdate &&
                        handleDisplayFiltersUpdate({
                          favorites: !isFavoriteFilterApplied,
                        })
                    : undefined
                }
              />
            </div>
          </div>
        )}
        {isEditingAllowed && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            stretch="auto"
            label={t("common.clear_all")}
            onClick={handleClearAllFilters}
          />
        )}
      </div>
    </Header>
  );
}
