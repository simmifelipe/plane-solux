/**
 * Solar: saved views of modules ("Visualizações de Demandas")
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
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
import { InputField } from "@makeplane/propel/components/input-field";
import { TextAreaField } from "@makeplane/propel/components/text-area-field";
import { useTranslation } from "@plane/i18n";
import type { TModuleDisplayFilters, TModuleFilters, TModuleView } from "@plane/types";
// local imports
import { ModuleViewAppliedFilters, ModuleViewFiltersControls } from "./filters-bar";

type Props = {
  data?: TModuleView | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<TModuleView>) => Promise<void>;
};

const DEFAULT_DISPLAY_FILTERS: TModuleDisplayFilters = { layout: "list", order_by: "name" };

export const CreateUpdateModuleViewModal = observer(function CreateUpdateModuleViewModal(props: Props) {
  const { data, isOpen, onClose, onSubmit } = props;
  const { t } = useTranslation();
  // state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filters, setFilters] = useState<TModuleFilters>({});
  const [displayFilters, setDisplayFilters] = useState<TModuleDisplayFilters>(DEFAULT_DISPLAY_FILTERS);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // reset the form every time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setName(data?.name ?? "");
    setDescription(data?.description ?? "");
    setFilters(data?.filters ?? {});
    setDisplayFilters({ ...DEFAULT_DISPLAY_FILTERS, ...(data?.display_filters ?? {}) });
    setError(null);
    setIsSubmitting(false);
  }, [isOpen, data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("form.title.required"));
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), description, filters, display_filters: displayFilters });
    } finally {
      setIsSubmitting(false);
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
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>{data ? t("module_view.update") : t("module_view.create")}</DialogTitle>
              </DialogHeading>
            </DialogHeader>
            <DialogBody tabIndex={0}>
              <div className="space-y-3">
                <InputField
                  size="lg"
                  orientation="vertical"
                  error={error ?? undefined}
                  id="name"
                  name="name"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder={t("common.title")}
                  aria-label={t("common.title")}
                  maxLength={255}
                  // oxlint-disable-next-line jsx_a11y/no-autofocus
                  autoFocus
                />
                <TextAreaField
                  size="xl"
                  autoResize
                  maxRows={8}
                  id="description"
                  name="description"
                  placeholder={t("common.description")}
                  aria-label={t("common.description")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <ModuleViewFiltersControls
                  filters={filters}
                  displayFilters={displayFilters}
                  onFiltersChange={setFilters}
                  onDisplayFiltersChange={setDisplayFilters}
                />
                <ModuleViewAppliedFilters
                  filters={filters}
                  displayFilters={displayFilters}
                  onFiltersChange={setFilters}
                  onDisplayFiltersChange={setDisplayFilters}
                />
              </div>
            </DialogBody>
          </DialogMain>
          <DialogActions>
            <Button variant="secondary" size="md" stretch="auto" label={t("common.cancel")} onClick={onClose} />
            <Button
              variant="primary"
              size="md"
              stretch="auto"
              type="submit"
              label={
                data
                  ? isSubmitting
                    ? t("common.updating")
                    : t("module_view.update")
                  : isSubmitting
                    ? t("common.creating")
                    : t("module_view.create")
              }
              loading={isSubmitting}
            />
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
});
