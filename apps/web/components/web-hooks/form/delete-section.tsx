/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { Collapsible } from "@makeplane/propel/components/collapsible";
import { useTranslation } from "@plane/i18n";

type Props = {
  openDeleteModal: () => void;
};

export function WebhookDeleteSection(props: Props) {
  const { t } = useTranslation();
  const { openDeleteModal } = props;
  // states
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full border-t border-subtle">
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        trigger={<span className="text-body-md-regular tracking-tight">{t("ui.danger_zone")}</span>}
      >
        <div className="flex flex-col gap-8">
          <span className="text-body-xs-regular tracking-tight">{t("ui.once_a_webhook_is_deleted_it_cannot")}</span>
          <div>
            <Button
              variant="danger"
              size="md"
              stretch="auto"
              label={t("ui.delete_webhook")}
              onClick={openDeleteModal}
            />
          </div>
        </div>
      </Collapsible>
    </div>
  );
}
