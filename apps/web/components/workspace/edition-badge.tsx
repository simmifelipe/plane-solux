/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// ui
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@makeplane/propel/components/tooltip";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
import packageJson from "package.json";

// Solar: mantém o selo "Community", mas sem abrir o modal de planos pagos
export const WorkspaceEditionBadge = observer(function WorkspaceEditionBadge() {
  // translation
  const { t } = useTranslation();
  // platform
  const { isMobile } = usePlatformOS();

  return (
    <Tooltip label={`Version: v${packageJson.version}`} disabled={isMobile}>
      <span
        className="inline-flex h-7 cursor-default items-center px-2 text-13 font-medium text-tertiary"
        aria-label={t("aria_labels.projects_sidebar.edition_badge")}
      >
        Community
      </span>
    </Tooltip>
  );
});
