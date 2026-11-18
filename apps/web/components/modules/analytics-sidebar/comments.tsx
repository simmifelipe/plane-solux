/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Solar: comments on a "Demanda" (module)

import { useMemo } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { TCommentsOperations, TIssueComment } from "@plane/types";
import { copyUrlToClipboard } from "@plane/utils";
// components
import { CommentsWrapper } from "@/components/comments";
// services
import { ModuleService } from "@/services/module.service";
// local imports
import { ModuleSidebarGroup } from "./sidebar-group";

const moduleService = new ModuleService();

type Props = {
  workspaceSlug: string;
  projectId: string;
  moduleId: string;
  canComment: boolean;
};

export const ModuleComments = observer(function ModuleComments(props: Props) {
  const { workspaceSlug, projectId, moduleId, canComment } = props;
  const { t } = useTranslation();

  const swrKey = `MODULE_COMMENTS_${moduleId}`;
  const { data: comments, mutate } = useSWR(swrKey, () =>
    moduleService.getModuleComments(workspaceSlug, projectId, moduleId)
  );

  const operations: TCommentsOperations = useMemo(
    () => ({
      copyCommentLink: (commentId) => {
        void copyUrlToClipboard(`${workspaceSlug}/projects/${projectId}/modules/${moduleId}#comment-${commentId}`).then(
          () =>
            setToast({ type: "success", title: t("common.success"), message: t("issue.comments.copy_link.success") })
        );
      },
      createComment: async (data) => {
        try {
          const comment = await moduleService.createModuleComment(workspaceSlug, projectId, moduleId, {
            comment_html: data.comment_html,
            comment_json: data.comment_json,
          });
          await mutate((current) => [...(current ?? []), comment], { revalidate: false });
          setToast({ type: "success", title: t("common.success"), message: t("issue.comments.create.success") });
          return comment;
        } catch {
          setToast({ type: "error", title: t("common.error.label"), message: t("issue.comments.create.error") });
          return undefined;
        }
      },
      updateComment: async (commentId, data) => {
        try {
          const updated = await moduleService.updateModuleComment(workspaceSlug, projectId, moduleId, commentId, {
            comment_html: data.comment_html,
            comment_json: data.comment_json,
          });
          await mutate((current) => (current ?? []).map((c) => (c.id === commentId ? updated : c)), {
            revalidate: false,
          });
          setToast({ type: "success", title: t("common.success"), message: t("issue.comments.update.success") });
        } catch {
          setToast({ type: "error", title: t("common.error.label"), message: t("issue.comments.update.error") });
        }
      },
      removeComment: async (commentId) => {
        try {
          await moduleService.deleteModuleComment(workspaceSlug, projectId, moduleId, commentId);
          await mutate((current) => (current ?? []).filter((c) => c.id !== commentId), { revalidate: false });
          setToast({ type: "success", title: t("common.success"), message: t("issue.comments.remove.success") });
        } catch {
          setToast({ type: "error", title: t("common.error.label"), message: t("issue.comments.remove.error") });
        }
      },
      // Images are not supported in module comments yet
      uploadCommentAsset: async () => {
        setToast({ type: "error", title: t("common.error.label"), message: t("ui.module_comment_images_unsupported") });
        throw new Error("Images are not supported in module comments");
      },
      duplicateCommentAsset: async () => {
        throw new Error("Images are not supported in module comments");
      },
      // Reactions are not supported on module comments
      addCommentReaction: async () => {},
      deleteCommentReaction: async () => {},
      react: async () => {},
      reactionIds: () => undefined,
      userReactions: () => undefined,
      getReactionUsers: () => "",
    }),
    [workspaceSlug, projectId, moduleId, mutate, t]
  );

  const commentList: TIssueComment[] = comments ?? [];

  return (
    <ModuleSidebarGroup
      defaultOpen
      label={commentList.length > 0 ? `${t("comments")} (${commentList.length})` : t("comments")}
    >
      <CommentsWrapper
        projectId={projectId}
        entityId={moduleId}
        isEditingAllowed={canComment}
        activityOperations={operations}
        comments={commentList}
        showCopyLinkOption={false}
      />
    </ModuleSidebarGroup>
  );
});
