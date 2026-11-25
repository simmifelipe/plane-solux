/**
 * Solar: full-screen viewer for image attachments (Esc closes, arrows move between images).
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CloseOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import type { TModuleAttachment } from "@/services/module-attachment.service";

type Props = {
  images: TModuleAttachment[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

export function ModuleImageLightbox({ images, index, onIndexChange, onClose }: Props) {
  const { t } = useTranslation();
  const image = images[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < images.length - 1) onIndexChange(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, onIndexChange]);

  if (!image || typeof document === "undefined") return null;

  const navButton = "absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-xl text-white hover:bg-black/70";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={image.attributes.name}
      onClick={onClose}
    >
      <button
        type="button"
        aria-label={t("close")}
        className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
        onClick={onClose}
      >
        <CloseOutline className="size-5" />
      </button>
      {index > 0 && (
        <button
          type="button"
          aria-label="‹"
          className={`${navButton} left-4`}
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index - 1);
          }}
        >
          ‹
        </button>
      )}
      {index < images.length - 1 && (
        <button
          type="button"
          aria-label="›"
          className={`${navButton} right-4`}
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index + 1);
          }}
        >
          ›
        </button>
      )}
      <img
        src={`${image.asset_url}?inline=1`}
        alt={image.attributes.name}
        className="max-h-[82vh] max-w-full rounded-md object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="mt-3 flex items-center gap-4 text-body-sm-regular text-white" onClick={(e) => e.stopPropagation()}>
        <span className="max-w-[60vw] truncate">{image.attributes.name}</span>
        <span className="text-white/60">
          {index + 1} / {images.length}
        </span>
        <a href={image.asset_url} className="rounded-md bg-white/15 px-3 py-1 hover:bg-white/25">
          {t("module_attachment.download")}
        </a>
      </div>
    </div>,
    document.body
  );
}
