/**
 * Solar: file attachments of a "Demanda" (module).
 */

import type { AxiosRequestConfig } from "axios";
import { API_BASE_URL } from "@plane/constants";
import { getFileMetaDataForUpload, generateFileUploadPayload } from "@plane/services";
import type { TIssueAttachment, TIssueAttachmentUploadResponse } from "@plane/types";
import { APIService } from "@/services/api.service";
import { FileUploadService } from "@/services/file-upload.service";

export type TModuleAttachment = Omit<TIssueAttachment, "issue_id" | "attributes"> & {
  attributes: { name: string; size: number; type?: string };
  created_at?: string;
};

/** Raster images the browser may render inline (same list as INLINE_SAFE_MIME_TYPES on the API). */
const PREVIEWABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]);
export const isPreviewableImage = (attachment: TModuleAttachment): boolean =>
  PREVIEWABLE_IMAGE_TYPES.has((attachment.attributes.type ?? "").toLowerCase());

/** Keep in sync with FILE_SIZE_LIMIT (apps/api/.env) and plane/utils/attachment_types.py. */
export const MODULE_ATTACHMENT_MAX_SIZE = 20 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set(
  (
    ".exe .msi .bat .cmd .com .scr .pif .cpl .dll .sys .sh .bash .zsh .csh .ps1 .psm1 .vbs .vbe .wsf .wsh .hta " +
    ".jar .apk .app .deb .rpm .bin .run .appimage .dmg .pkg .lnk .reg .msp .gadget .jse .js .mjs"
  ).split(" ")
);

/** Returns an i18n key describing why the file is refused, or null when it is fine. */
export const validateModuleAttachment = (file: File): "size" | "type" | null => {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (BLOCKED_EXTENSIONS.has(ext)) return "type";
  if (file.size > MODULE_ATTACHMENT_MAX_SIZE) return "size";
  return null;
};

export class ModuleAttachmentService extends APIService {
  private fileUploadService: FileUploadService;

  constructor() {
    super(API_BASE_URL);
    this.fileUploadService = new FileUploadService();
  }

  private base(workspaceSlug: string, projectId: string, moduleId: string) {
    return `/api/assets/v2/workspaces/${workspaceSlug}/projects/${projectId}/modules/${moduleId}/attachments/`;
  }

  async list(workspaceSlug: string, projectId: string, moduleId: string): Promise<TModuleAttachment[]> {
    return this.get(this.base(workspaceSlug, projectId, moduleId))
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async upload(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    file: File,
    uploadProgressHandler?: AxiosRequestConfig["onUploadProgress"]
  ): Promise<TModuleAttachment> {
    const fileMetaData = await getFileMetaDataForUpload(file);
    return this.post(this.base(workspaceSlug, projectId, moduleId), fileMetaData)
      .then(async (response) => {
        const signed: TIssueAttachmentUploadResponse = response?.data;
        const payload = generateFileUploadPayload(signed, file);
        await this.fileUploadService.uploadFile(signed.upload_data.url, payload, uploadProgressHandler);
        await this.patch(`${this.base(workspaceSlug, projectId, moduleId)}${signed.asset_id}/`);
        return signed.attachment as unknown as TModuleAttachment;
      })
      .catch((error) => {
        throw error?.response?.data ?? error;
      });
  }

  async remove(workspaceSlug: string, projectId: string, moduleId: string, assetId: string): Promise<void> {
    return this.delete(`${this.base(workspaceSlug, projectId, moduleId)}${assetId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}

export const moduleAttachmentService = new ModuleAttachmentService();
