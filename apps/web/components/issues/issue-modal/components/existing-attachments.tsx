/**
 * Solar: attachments already on a work item, shown while editing it (add more with the picker above).
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { setToast } from "@plane/blocks/toast";
import { AttachOutline, DeleteOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
// hooks
import { useUser } from "@/hooks/store/user";
import { IssueAttachmentService } from "@/services/issue";
// local imports
import { formatFileSize } from "@/components/modules/attachments/file-utils";

const issueAttachmentService = new IssueAttachmentService();

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
};

export const IssueExistingAttachments = observer(function IssueExistingAttachments(props: Props) {
  const { workspaceSlug, projectId, issueId } = props;
  const { t } = useTranslation();
  const { data: currentUser } = useUser();
  const [removing, setRemoving] = useState<string | null>(null);

  const { data: attachments, mutate } = useSWR(`ISSUE_MODAL_ATTACHMENTS_${issueId}`, () =>
    issueAttachmentService.getIssueAttachments(workspaceSlug, projectId, issueId)
  );

  if (!attachments?.length) return null;

  const handleDelete = async (assetId: string) => {
    setRemoving(assetId);
    try {
      await issueAttachmentService.deleteIssueAttachment(workspaceSlug, projectId, issueId, assetId);
      await mutate();
    } catch (err: any) {
      setToast({
        type: "error",
        title: t("toast.error"),
        message: err?.error ?? t("module_attachment.delete_failed"),
      });
    }
    setRemoving(null);
  };

  return (
    <div className="mt-2 space-y-1">
      <p className="text-body-xs-medium text-secondary">
        {t("module_attachment.title")} <span className="text-tertiary">({attachments.length})</span>
      </p>
      <ul className="space-y-1">
        {attachments.map((attachment) => (
          <li
            key={attachment.id}
            className="flex items-center justify-between gap-2 rounded-sm bg-layer-1 px-2 py-1 text-body-xs-regular"
          >
            <a
              href={attachment.asset_url}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-1.5 text-primary hover:underline"
              title={attachment.attributes.name}
            >
              <AttachOutline className="size-3.5 flex-shrink-0 text-tertiary" />
              <span className="truncate">{attachment.attributes.name}</span>
            </a>
            <span className="flex flex-shrink-0 items-center gap-2 text-tertiary">
              {formatFileSize(attachment.attributes.size)}
              {attachment.created_by === currentUser?.id && (
                <button
                  type="button"
                  disabled={removing === attachment.id}
                  aria-label={t("module_attachment.delete")}
                  className="hover:text-danger-primary disabled:opacity-50"
                  onClick={() => void handleDelete(attachment.id)}
                >
                  <DeleteOutline className="size-3.5" />
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});
