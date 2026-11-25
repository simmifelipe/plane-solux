/**
 * Solar: small paperclip shown on module ("Demanda") rows/cards that have attachments.
 */

import { AttachOutline } from "@makeplane/propel/icons";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { useTranslation } from "@plane/i18n";

export function ModuleAttachmentIndicator({ count }: { count?: number }) {
  const { t } = useTranslation();
  if (!count) return null;
  return (
    <Tooltip label={t("module_attachment.count", { count })}>
      <span
        className="flex flex-shrink-0 items-center gap-0.5 text-caption-sm-regular text-tertiary"
        aria-label={t("module_attachment.count", { count })}
      >
        <AttachOutline className="size-3.5" />
        {count}
      </span>
    </Tooltip>
  );
}
