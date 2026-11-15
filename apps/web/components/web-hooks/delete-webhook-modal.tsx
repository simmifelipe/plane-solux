/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useParams } from "next/navigation";
// ui
import { ConfirmDialog } from "@plane/blocks/dialog";
import { setToast } from "@plane/blocks/toast";
// hooks
import { useWebhook } from "@/hooks/store/use-webhook";
import { useAppRouter } from "@/hooks/use-app-router";
import { useTranslation } from "@plane/i18n";

interface IDeleteWebhook {
  isOpen: boolean;
  onClose: () => void;
  /** The webhook to delete; defaults to the one in the route (its detail page). */
  webhookId?: string;
}

export function DeleteWebhookModal(props: IDeleteWebhook) {
  const { t } = useTranslation();
  const { isOpen, onClose, webhookId: webhookIdProp } = props;
  // states
  const [isDeleting, setIsDeleting] = useState(false);
  // router
  const router = useAppRouter();
  // store hooks
  const { removeWebhook } = useWebhook();

  const { workspaceSlug, webhookId: webhookIdParam } = useParams();
  const webhookId = webhookIdProp ?? webhookIdParam;

  const handleClose = () => {
    onClose();
  };

  const handleDelete = async () => {
    if (!workspaceSlug || !webhookId) return;
    setIsDeleting(true);
    try {
      await removeWebhook(workspaceSlug.toString(), webhookId.toString());
      handleClose();
      router.replace(`/${workspaceSlug}/settings/webhooks/`);
      setToast({
        type: "success",
        title: t("toast.success"),
        message: t("ui.webhook_deleted_successfully"),
      });
    } catch (_error) {
      setToast({
        type: "error",
        title: t("toast.error"),
        message: t("ui.webhook_could_not_be_deleted_please_try"),
      });
    }
    setIsDeleting(false);
  };

  return (
    <ConfirmDialog
      handleClose={handleClose}
      handleSubmit={handleDelete}
      isSubmitting={isDeleting}
      isOpen={isOpen}
      title={t("ui.delete_webhook")}
      content={<>{t("ui.are_you_sure_you_want_to_delete")}</>}
    />
  );
}
