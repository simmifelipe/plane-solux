/**
 * Solar: approve a request (intake) as a "Demanda" — the module form, pre-filled from the request.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Dialog, DialogContent } from "@makeplane/propel/components/dialog";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { IModule } from "@plane/types";
// components
import { ModuleForm } from "@/components/modules/form";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
// store
import type { IInboxIssueStore } from "@/store/inbox/inbox-issue.store";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  inboxIssue: IInboxIssueStore;
  projectId: string;
  onConverted: () => void;
};

export const IntakeConvertToModuleModal = observer(function IntakeConvertToModuleModal(props: Props) {
  const { isOpen, onClose, inboxIssue, projectId, onConverted } = props;
  const { t } = useTranslation();
  const { isMobile } = usePlatformOS();
  const [, setActiveProject] = useState<string | null>(null);

  if (!isOpen) return null;

  const issue = inboxIssue.issue;
  const initialValues: Partial<IModule> = {
    name: issue.name ?? "",
    description: (issue.description_html ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    priority: (issue.priority as IModule["priority"]) ?? "none",
    label_ids: issue.label_ids ?? [],
  };

  const handleSubmit = async (payload: Partial<IModule>) => {
    try {
      await inboxIssue.convertToModule(payload);
      setToast({
        type: "success",
        title: t("toast.success"),
        message: t("intake_convert.converted"),
      });
      onClose();
      onConverted();
    } catch (err: any) {
      const firstFieldError = err && typeof err === "object" ? Object.values(err).flat()[0] : undefined;
      setToast({
        type: "error",
        title: t("toast.error"),
        message:
          err?.error ?? (typeof firstFieldError === "string" ? firstFieldError : t("intake_convert.convert_failed")),
      });
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      disablePointerDismissal
    >
      <DialogContent size="md">
        <ModuleForm
          handleFormSubmit={handleSubmit}
          handleClose={onClose}
          status={false}
          projectId={projectId}
          setActiveProject={setActiveProject}
          initialValues={initialValues}
          isMobile={isMobile}
        />
      </DialogContent>
    </Dialog>
  );
});
