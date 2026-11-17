/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { useTranslation } from "@plane/i18n";

type Props = {
  /** i18n key */
  emptyText?: string;
};

export function PowerKMenuEmptyState({ emptyText = "power_k.search_menu.no_results" }: Props) {
  const { t } = useTranslation();
  return <div className="px-3 py-8 text-center text-body-xs-regular text-tertiary">{t(emptyText)}</div>;
}
