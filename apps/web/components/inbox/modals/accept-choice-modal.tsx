/**
 * Solar: when approving a request (intake), choose what it becomes.
 * "Demanda" (module) is the default; a work item must be linked to an existing Demanda.
 */

import { useEffect, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";

export type TAcceptTarget = "module" | "work_item";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (target: TAcceptTarget) => void;
};

export function IntakeAcceptChoiceModal({ isOpen, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<TAcceptTarget>("module");

  useEffect(() => {
    if (isOpen) setTarget("module");
  }, [isOpen]);

  const options: { key: TAcceptTarget; title: string; description: string; badge?: string }[] = [
    {
      key: "module",
      title: t("intake_convert.module_title"),
      description: t("intake_convert.module_description"),
      badge: t("intake_convert.default"),
    },
    {
      key: "work_item",
      title: t("intake_convert.work_item_title"),
      description: t("intake_convert.work_item_description"),
    },
  ];

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{t("intake_convert.title")}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div role="radiogroup" aria-label={t("intake_convert.title")} className="space-y-2">
              {options.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={target === option.key}
                  onClick={() => setTarget(option.key)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    target === option.key
                      ? "border-accent-strong bg-accent-subtle"
                      : "border-subtle hover:bg-layer-1-hover"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "grid size-4 flex-shrink-0 place-items-center rounded-full border",
                        target === option.key ? "border-accent-strong" : "border-subtle"
                      )}
                    >
                      {target === option.key && <span className="size-2 rounded-full bg-accent-primary" />}
                    </span>
                    <span className="text-body-sm-medium text-primary">{option.title}</span>
                    {option.badge && (
                      <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-caption-sm-medium text-accent-primary">
                        {option.badge}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block pl-6 text-body-xs-regular text-tertiary">{option.description}</span>
                </button>
              ))}
            </div>
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button variant="secondary" size="md" stretch="auto" label={t("common.cancel")} onClick={onClose} />
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            label={t("intake_convert.continue")}
            onClick={() => onConfirm(target)}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
