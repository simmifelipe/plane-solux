/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { Switch } from "@makeplane/propel/components/switch";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TResourceAccessGrant, TResourceAccessKind, TResourceAccessState } from "@plane/types";
// hooks
import { useMember } from "@/hooks/store/use-member";
// services
import { ResourceAccessService } from "@/services/resource-access.service";

const resourceAccessService = new ResourceAccessService();

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onRestrictionChange?: (isRestricted: boolean) => void;
  workspaceSlug: string;
  projectId: string;
  kind: TResourceAccessKind;
  resourceId: string;
};

type TAction = "can_view" | "can_comment" | "can_edit";

export const ResourceAccessModal = observer(function ResourceAccessModal(props: Props) {
  const { isOpen, onClose, onRestrictionChange, workspaceSlug, projectId, kind, resourceId } = props;
  const { t } = useTranslation();
  // store hooks
  const {
    getUserDetails,
    project: { getProjectMemberIds },
  } = useMember();
  // states
  const [state, setState] = useState<TResourceAccessState | undefined>();
  const [isBusy, setIsBusy] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  // `t` is not referentially stable; keep it out of effect dependencies so the fetch below runs once per open
  const tRef = useRef(t);
  tRef.current = t;

  const notifyError = useCallback(
    () => setToast({ type: "error", title: t("toast.error"), message: t("resource_access.toast.error") }),
    [t]
  );

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    resourceAccessService
      .getAccess(workspaceSlug, projectId, kind, resourceId)
      .then((data) => {
        if (!cancelled) setState(data);
        return data;
      })
      .catch(() => {
        if (!cancelled)
          setToast({
            type: "error",
            title: tRef.current("toast.error"),
            message: tRef.current("resource_access.toast.load_error"),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, workspaceSlug, projectId, kind, resourceId]);

  // runs one request, then refreshes the whole panel from the server
  const run = async (request: () => Promise<unknown>) => {
    setIsBusy(true);
    try {
      await request();
      const fresh = await resourceAccessService.getAccess(workspaceSlug, projectId, kind, resourceId);
      setState(fresh);
      onRestrictionChange?.(fresh.is_restricted);
    } catch {
      notifyError();
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleRestricted = (value: boolean) =>
    run(() => resourceAccessService.setRestricted(workspaceSlug, projectId, kind, resourceId, value));

  const handleAdd = () => {
    if (!selectedUserId) return;
    const userId = selectedUserId;
    setSelectedUserId("");
    return run(() => resourceAccessService.saveGrant(workspaceSlug, projectId, kind, resourceId, { user_id: userId }));
  };

  const handleChange = (grant: TResourceAccessGrant, action: TAction, value: boolean) => {
    const next = { ...grant, [action]: value };
    // the backend rejects a grant with no action at all; removing it is a different, explicit button
    if (!next.can_view && !next.can_comment && !next.can_edit) return;
    return run(() =>
      resourceAccessService.saveGrant(workspaceSlug, projectId, kind, resourceId, {
        user_id: grant.user_id,
        can_view: next.can_view,
        can_comment: next.can_comment,
        can_edit: next.can_edit,
      })
    );
  };

  const handleRemove = (grant: TResourceAccessGrant) =>
    run(() => resourceAccessService.removeGrant(workspaceSlug, projectId, kind, resourceId, grant.user_id));

  // derived values
  const grantedIds = new Set((state?.grants ?? []).map((grant) => grant.user_id));
  const candidateIds = (getProjectMemberIds(projectId, true) ?? []).filter((id) => !grantedIds.has(id));
  const memberName = (userId: string) => getUserDetails(userId)?.display_name ?? userId;

  const actions: { key: TAction; label: string }[] = [
    { key: "can_view", label: t("resource_access.view") },
    { key: "can_comment", label: t("resource_access.comment") },
    { key: "can_edit", label: t("resource_access.edit") },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{t("resource_access.title")}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody tabIndex={0}>
            <div className="space-y-5">
              <p className="text-body-xs-regular text-secondary">
                {t(kind === "module" ? "resource_access.description_module" : "resource_access.description_issue")}
              </p>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-body-sm-medium">{t("resource_access.restrict")}</div>
                  <div className="text-body-xs-regular text-secondary">{t("resource_access.restrict_hint")}</div>
                </div>
                <Switch
                  size="sm"
                  checked={state?.is_restricted ?? false}
                  disabled={!state || isBusy}
                  onCheckedChange={handleToggleRestricted}
                  aria-label={t("resource_access.restrict")}
                />
              </div>

              {state?.is_restricted && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <select
                      className="min-w-0 flex-1 rounded-md border border-subtle bg-surface-1 px-2 py-1.5 text-body-xs-regular"
                      value={selectedUserId}
                      disabled={isBusy}
                      onChange={(event) => setSelectedUserId(event.target.value)}
                      aria-label={t("resource_access.add_user")}
                    >
                      <option value="">{t("resource_access.select_user")}</option>
                      {candidateIds.map((id) => (
                        <option key={id} value={id}>
                          {memberName(id)}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="primary"
                      size="md"
                      stretch="auto"
                      disabled={!selectedUserId || isBusy}
                      onClick={handleAdd}
                      label={t("resource_access.add")}
                    />
                  </div>

                  {state.grants.length === 0 ? (
                    <p className="text-body-xs-regular text-secondary">{t("resource_access.no_grants")}</p>
                  ) : (
                    <ul className="divide-y divide-subtle">
                      {state.grants.map((grant) => (
                        <li key={grant.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
                          <span className="min-w-0 flex-1 truncate text-body-xs-medium">
                            {memberName(grant.user_id)}
                          </span>
                          {actions.map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-1.5 text-body-xs-regular">
                              <Checkbox
                                checked={grant[key]}
                                // comment and edit imply view, so view cannot be cleared while either is on
                                disabled={isBusy || (key === "can_view" && (grant.can_comment || grant.can_edit))}
                                onCheckedChange={(value) => handleChange(grant, key, value === true)}
                                aria-label={`${memberName(grant.user_id)} – ${label}`}
                              />
                              {label}
                            </label>
                          ))}
                          <Button
                            variant="secondary"
                            size="sm"
                            stretch="auto"
                            disabled={isBusy}
                            onClick={() => handleRemove(grant)}
                            label={t("resource_access.remove")}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </DialogBody>
        </DialogMain>
      </DialogContent>
    </Dialog>
  );
});
