/**
 * Solar: file picker used while creating a module ("Demanda"). Files are only held in memory here
 * and uploaded right after the module exists (see modal.tsx).
 */

import { useRef } from "react";
import { setToast } from "@plane/blocks/toast";
import { AttachOutline, CloseOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import { MODULE_ATTACHMENT_MAX_SIZE, validateModuleAttachment } from "@/services/module-attachment.service";
import { formatFileSize } from "./file-utils";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
};

export function ModulePendingFiles({ files, onChange }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | File[]) => {
    const accepted: File[] = [];
    Array.from(incoming).forEach((file) => {
      const problem = validateModuleAttachment(file);
      if (problem === "size")
        setToast({
          type: "error",
          title: t("toast.error"),
          message: t("module_attachment.too_large", { name: file.name, size: MODULE_ATTACHMENT_MAX_SIZE / 1048576 }),
        });
      else if (problem === "type")
        setToast({
          type: "error",
          title: t("toast.error"),
          message: t("module_attachment.type_blocked", { name: file.name }),
        });
      else if (!files.some((f) => f.name === file.name && f.size === file.size)) accepted.push(file);
    });
    if (accepted.length) onChange([...files, ...accepted]);
  };

  return (
    <div
      className="rounded-md border border-dashed border-subtle p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        addFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="flex items-center gap-1.5 text-body-xs-medium text-secondary hover:text-primary"
        onClick={() => inputRef.current?.click()}
      >
        <AttachOutline className="size-4" />
        {t("module_attachment.add_files")}
        <span className="text-tertiary">· {t("module_attachment.hint", { size: MODULE_ATTACHMENT_MAX_SIZE / 1048576 })}</span>
      </button>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((file) => (
            <li
              key={`${file.name}-${file.size}`}
              className="flex items-center justify-between gap-2 rounded-sm bg-layer-1 px-2 py-1 text-body-xs-regular"
            >
              <span className="truncate text-primary">{file.name}</span>
              <span className="flex flex-shrink-0 items-center gap-2 text-tertiary">
                {formatFileSize(file.size)}
                <button
                  type="button"
                  aria-label={t("remove")}
                  className="hover:text-primary"
                  onClick={() => onChange(files.filter((f) => f !== file))}
                >
                  <CloseOutline className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
