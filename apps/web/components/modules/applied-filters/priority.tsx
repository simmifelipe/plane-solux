/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { ISSUE_PRIORITIES } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { PriorityIcon } from "@plane/blocks/icons";
import { RemovableChip } from "@/components/common/removable-chip";

type Props = {
  handleRemove: (val: string) => void;
  values: string[];
  editable: boolean | undefined;
};

// Solar: applied priority filter chips for "Demandas" (modules)
export const AppliedPriorityFilters = observer(function AppliedPriorityFilters(props: Props) {
  const { handleRemove, values, editable } = props;
  const { t } = useTranslation();

  return (
    <>
      {values.map((priority) => {
        const priorityDetails = ISSUE_PRIORITIES.find((p) => p.key === priority);
        if (!priorityDetails) return null;

        return (
          <RemovableChip
            key={priority}
            variant="soft"
            icon={<PriorityIcon priority={priorityDetails.key} className="size-3" />}
            label={t(priorityDetails.i18n_title)}
            ariaLabel={t(priorityDetails.i18n_title)}
            onRemove={editable ? () => handleRemove(priority) : undefined}
          />
        );
      })}
    </>
  );
});
