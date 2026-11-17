/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TIssueActivity } from "@plane/types";

/** Returns the i18n key of the relation activity message. */
export const getRelationActivityContent = (activity: TIssueActivity | undefined): string | undefined => {
  if (!activity) return;

  switch (activity.field) {
    case "blocking":
      return activity.old_value === ""
        ? "ui.activity_relation_blocking_added"
        : "ui.activity_relation_blocking_removed";
    case "blocked_by":
      return activity.old_value === ""
        ? "ui.activity_relation_blocked_by_added"
        : "ui.activity_relation_blocked_by_removed";
    case "duplicate":
      return activity.old_value === ""
        ? "ui.activity_relation_duplicate_added"
        : "ui.activity_relation_duplicate_removed";
    case "relates_to":
      return activity.old_value === "" ? "ui.activity_relation_relates_to_added" : "ui.activity_relation_relates_to_removed";
  }

  return;
};
