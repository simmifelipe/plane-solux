/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import useSWR from "swr";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import type { TNameDescriptionLoader } from "@plane/types";
// components
import { ContentWrapper } from "@plane/blocks/layout";
import { useTranslation } from "@plane/i18n";
// hooks
import { useModule } from "@/hooks/store/use-module";
import { useProjectInbox } from "@/hooks/store/use-project-inbox";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// local imports
import { InboxIssueActionsHeader } from "./inbox-issue-header";
import { InboxIssueMainContent } from "./issue-root";

type TInboxContentRoot = {
  workspaceSlug: string;
  projectId: string;
  inboxIssueId: string;
  isMobileSidebar: boolean;
  setIsMobileSidebar: (value: boolean) => void;
  isNotificationEmbed?: boolean;
  embedRemoveCurrentNotification?: () => void;
};

export const InboxContentRoot = observer(function InboxContentRoot(props: TInboxContentRoot) {
  const {
    workspaceSlug,
    projectId,
    inboxIssueId,
    isMobileSidebar,
    setIsMobileSidebar,
    isNotificationEmbed = false,
    embedRemoveCurrentNotification,
  } = props;
  const { t } = useTranslation();
  /// router
  const router = useAppRouter();
  // states
  const [isSubmitting, setIsSubmitting] = useState<TNameDescriptionLoader>("saved");
  // hooks
  const { data: currentUser } = useUser();
  const { currentTab, fetchInboxIssueById, getIssueInboxByIssueId, getIsIssueAvailable } = useProjectInbox();
  const inboxIssue = getIssueInboxByIssueId(inboxIssueId);
  const { allowPermissions, getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();

  // derived values
  const isIssueAvailable = getIsIssueAvailable(inboxIssueId?.toString() || "");

  useEffect(() => {
    if (!isIssueAvailable && inboxIssueId && !isNotificationEmbed) {
      router.replace(`/${workspaceSlug}/projects/${projectId}/intake?currentTab=${currentTab}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIssueAvailable, isNotificationEmbed]);

  useSWR(
    workspaceSlug && projectId && inboxIssueId
      ? `PROJECT_INBOX_ISSUE_DETAIL_${workspaceSlug}_${projectId}_${inboxIssueId}`
      : null,
    workspaceSlug && projectId && inboxIssueId
      ? () => fetchInboxIssueById(workspaceSlug, projectId, inboxIssueId)
      : null,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
    }
  );

  const isEditable =
    allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId) ||
    inboxIssue?.issue.created_by === currentUser?.id;

  // Solar: requests converted into a Demanda link to it (name loaded lazily)
  const { getModuleById, fetchModulesSlim } = useModule();
  useSWR(
    inboxIssue?.converted_module && workspaceSlug && projectId ? `INTAKE_CONVERTED_MODULES_${projectId}` : null,
    () => fetchModulesSlim(workspaceSlug, projectId),
    { revalidateOnFocus: false }
  );
  const convertedModule = inboxIssue?.converted_module ? getModuleById(inboxIssue.converted_module) : null;

  const isGuest = getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId) === EUserPermissions.GUEST;
  const isOwner = inboxIssue?.issue.created_by === currentUser?.id;
  const readOnly = !isOwner && isGuest;

  if (!inboxIssue) return <></>;

  const isIssueDisabled = [-1, 1, 2].includes(inboxIssue.status);

  return (
    <>
      <div className="relative flex h-full w-full flex-col overflow-hidden">
        <div className="z-[11] min-h-[52px] flex-shrink-0">
          <InboxIssueActionsHeader
            setIsMobileSidebar={setIsMobileSidebar}
            isMobileSidebar={isMobileSidebar}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            inboxIssue={inboxIssue}
            isSubmitting={isSubmitting}
            isNotificationEmbed={isNotificationEmbed || false}
            embedRemoveCurrentNotification={embedRemoveCurrentNotification}
          />
        </div>
        {inboxIssue.converted_module && (
          <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-subtle bg-success-subtle px-page-x py-2 text-body-xs-regular text-primary">
            <span>
              {convertedModule?.name
                ? t("intake_convert.banner_named", { name: convertedModule.name })
                : t("intake_convert.banner")}
            </span>
            <Link
              href={`/${workspaceSlug}/projects/${projectId}/modules/${inboxIssue.converted_module}`}
              className="text-body-xs-medium text-accent-primary hover:underline"
            >
              {t("intake_convert.open_module")}
            </Link>
          </div>
        )}
        <ContentWrapper>
          <InboxIssueMainContent
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            inboxIssue={inboxIssue}
            isEditable={isEditable && !isIssueDisabled && !readOnly}
            isSubmitting={isSubmitting}
            setIsSubmitting={setIsSubmitting}
          />
        </ContentWrapper>
      </div>
    </>
  );
});
