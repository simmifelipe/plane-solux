/**
 * Solar: "Anexos" section of the module ("Demanda") sidebar — list, upload and delete files.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { setToast } from "@plane/blocks/toast";
import { AttachOutline, DeleteOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
// hooks
import { useModule } from "@/hooks/store/use-module";
import { useUser } from "@/hooks/store/user";
import {
  MODULE_ATTACHMENT_MAX_SIZE,
  moduleAttachmentService,
  validateModuleAttachment,
} from "@/services/module-attachment.service";
import { formatFileSize } from "./file-utils";

type Props = {
  workspaceSlug: string;
  projectId: string;
  moduleId: string;
  canEdit: boolean;
  isAdmin?: boolean;
};

export const moduleAttachmentsKey = (workspaceSlug: string, projectId: string, moduleId: string) =>
  `MODULE_ATTACHMENTS_${workspaceSlug}_${projectId}_${moduleId}`;

export const ModuleAttachmentsSection = observer(function ModuleAttachmentsSection(props: Props) {
  const { workspaceSlug, projectId, moduleId, canEdit, isAdmin = false } = props;
  const { t } = useTranslation();
  const { fetchModuleDetails } = useModule();
  const { data: currentUser } = useUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<Record<string, number>>({});

  const { data: attachments, mutate } = useSWR(moduleAttachmentsKey(workspaceSlug, projectId, moduleId), () =>
    moduleAttachmentService.list(workspaceSlug, projectId, moduleId)
  );

  const refresh = async () => {
    await mutate();
    // refreshes attachment_count in the module lists
    void fetchModuleDetails(workspaceSlug, projectId, moduleId);
  };

  const fail = (message: string) => setToast({ type: "error", title: t("toast.error"), message });

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const problem = validateModuleAttachment(file);
      if (problem === "size") {
        fail(t("module_attachment.too_large", { name: file.name, size: MODULE_ATTACHMENT_MAX_SIZE / 1048576 }));
        continue;
      }
      if (problem === "type") {
        fail(t("module_attachment.type_blocked", { name: file.name }));
        continue;
      }
      setUploading((cur) => ({ ...cur, [file.name]: 0 }));
      try {
        await moduleAttachmentService.upload(workspaceSlug, projectId, moduleId, file, (e) => {
          const total = e.total;
          if (total) setUploading((cur) => ({ ...cur, [file.name]: Math.round((e.loaded * 100) / total) }));
        });
      } catch (err: any) {
        fail(err?.error ?? t("module_attachment.upload_failed", { name: file.name }));
      }
      setUploading((cur) => {
        const { [file.name]: _done, ...rest } = cur;
        return rest;
      });
    }
    await refresh();
  };

  const handleDelete = async (assetId: string) => {
    try {
      await moduleAttachmentService.remove(workspaceSlug, projectId, moduleId, assetId);
      await refresh();
    } catch (err: any) {
      fail(err?.error ?? t("module_attachment.delete_failed"));
    }
  };

  const count = attachments?.length ?? 0;

  return (
    <div className="flex flex-col gap-2 px-page-x py-3">
      <div className="flex items-center justify-between">
        <span className="text-body-xs-medium text-secondary">
          {t("module_attachment.title")}
          {count > 0 && <span className="ml-1 text-tertiary">({count})</span>}
        </span>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="flex items-center gap-1 text-body-xs-medium text-accent-primary hover:underline"
              onClick={() => inputRef.current?.click()}
            >
              <AttachOutline className="size-3.5" />
              {t("module_attachment.add")}
            </button>
          </>
        )}
      </div>
      {Object.entries(uploading).map(([name, progress]) => (
        <div key={name} className="rounded-sm bg-layer-1 px-2 py-1.5 text-body-xs-regular">
          <div className="flex justify-between gap-2">
            <span className="truncate text-primary">{name}</span>
            <span className="text-tertiary">{progress}%</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-layer-2">
            <div className="h-full bg-accent-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ))}
      {count === 0 && Object.keys(uploading).length === 0 && (
        <p className="text-body-xs-regular text-tertiary">{t("module_attachment.empty")}</p>
      )}
      <ul className="space-y-1">
        {attachments?.map((attachment) => {
          const canDelete = canEdit && (isAdmin || attachment.created_by === currentUser?.id);
          return (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-2 rounded-sm bg-layer-1 px-2 py-1.5 text-body-xs-regular"
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
                {canDelete && (
                  <button
                    type="button"
                    aria-label={t("module_attachment.delete")}
                    className="hover:text-danger-primary"
                    onClick={() => void handleDelete(attachment.id)}
                  >
                    <DeleteOutline className="size-3.5" />
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
