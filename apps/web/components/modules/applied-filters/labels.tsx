/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { RemovableChip } from "@/components/common/removable-chip";
import { useLabel } from "@/hooks/store/use-label";

type Props = {
  handleRemove: (val: string) => void;
  values: string[];
  editable: boolean | undefined;
};

// Solar: applied label filter chips for "Demandas" (modules)
export const AppliedLabelsFilters = observer(function AppliedLabelsFilters(props: Props) {
  const { handleRemove, values, editable } = props;
  const { getLabelById } = useLabel();

  return (
    <>
      {values.map((labelId) => {
        const label = getLabelById(labelId);
        if (!label) return null;

        return (
          <RemovableChip
            key={labelId}
            variant="soft"
            icon={<span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: label.color || undefined }} />}
            label={label.name}
            ariaLabel={label.name}
            onRemove={editable ? () => handleRemove(labelId) : undefined}
          />
        );
      })}
    </>
  );
});
