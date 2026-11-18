/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
// components
import { FilterSubmenu } from "@/components/common/filters/filter-submenu";
// hooks
import { useLabel } from "@/hooks/store/use-label";

type Props = {
  appliedFilters: string[] | null;
  handleUpdate: (val: string) => void;
};

// Solar: filter "Demandas" (modules) by project labels
export const FilterLabels = observer(function FilterLabels(props: Props) {
  const { appliedFilters, handleUpdate } = props;
  const { projectId } = useParams();
  const { t } = useTranslation();
  const { getProjectLabels } = useLabel();
  const options = (getProjectLabels(projectId?.toString()) ?? []).map((label) => ({
    value: label.id,
    label: label.name,
    icon: <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: label.color || undefined }} />,
  }));

  return (
    <FilterSubmenu
      label={t("labels")}
      options={options}
      appliedFilters={appliedFilters}
      onToggle={handleUpdate}
      searchable
    />
  );
});
