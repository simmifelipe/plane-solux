/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { ISSUE_PRIORITIES } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { PriorityIcon } from "@plane/blocks/icons";
// components
import { FilterSubmenu } from "@/components/common/filters/filter-submenu";

type Props = {
  appliedFilters: string[] | null;
  handleUpdate: (val: string) => void;
};

// Solar: filter "Demandas" (modules) by priority
export const FilterPriority = observer(function FilterPriority(props: Props) {
  const { appliedFilters, handleUpdate } = props;
  const { t } = useTranslation();
  const options = ISSUE_PRIORITIES.map((priority) => ({
    value: priority.key,
    label: t(priority.i18n_title),
    icon: <PriorityIcon priority={priority.key} />,
  }));

  return (
    <FilterSubmenu
      label={t("common.priority")}
      options={options}
      appliedFilters={appliedFilters}
      onToggle={handleUpdate}
    />
  );
});
