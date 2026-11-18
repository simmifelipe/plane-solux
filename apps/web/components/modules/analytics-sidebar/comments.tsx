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
import { EFileAssetType } from "@plane/types";
import type { TCommentsOperations, TIssueComment } from "@plane/types";
import { copyUrlToClipboard, formatTextList } from "@plane/utils";
// components
import { CommentsWrapper } from "@/components/comments";
// hooks
import { useEditorAsset } from "@/hooks/store/use-editor-asset";
import { useMember } from "@/hooks/store/use-member";
import { useUser } from "@/hooks/store/user";
// services
import { ModuleService } from "@/services/module.service";
import type { TModuleCommentReaction } from "@/services/module.service";
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
  const { uploadEditorAsset, duplicateEditorAsset } = useEditorAsset();
  const { getUserDetails } = useMember();
  const { data: currentUser } = useUser();

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
      // Images: bound to the module (entity_identifier = module id), so access follows the module
      uploadCommentAsset: async (blockId, file) => {
        try {
          return await uploadEditorAsset({
            blockId,
            data: { entity_identifier: moduleId, entity_type: EFileAssetType.MODULE_COMMENT_DESCRIPTION },
            file,
            projectId,
            workspaceSlug,
          });
        } catch (error) {
          throw new Error(t("issue.comments.upload.error"), { cause: error });
        }
      },
      duplicateCommentAsset: async (assetId) =>
        duplicateEditorAsset({
          assetId,
          entityId: moduleId,
          entityType: EFileAssetType.MODULE_COMMENT_DESCRIPTION,
          projectId,
          workspaceSlug,
        }),
      addCommentReaction: async (commentId, reaction) => {
        try {
          const created = await moduleService.createModuleCommentReaction(
            workspaceSlug,
            projectId,
            moduleId,
            commentId,
            reaction
          );
          await mutate(
            (current) =>
              (current ?? []).map((c) =>
                c.id === commentId
                  ? {
                      ...c,
                      comment_reactions: [
                        ...(c.comment_reactions ?? []).filter((r: TModuleCommentReaction) => r.id !== created.id),
                        created,
                      ],
                    }
                  : c
              ),
            { revalidate: false }
          );
        } catch {
          setToast({ type: "error", title: t("toast.error"), message: t("ui.reaction_creation_failed") });
        }
      },
      deleteCommentReaction: async (commentId, reaction) => {
        try {
          await moduleService.deleteModuleCommentReaction(workspaceSlug, projectId, moduleId, commentId, reaction);
          await mutate(
            (current) =>
              (current ?? []).map((c) =>
                c.id === commentId
                  ? {
                      ...c,
                      comment_reactions: (c.comment_reactions ?? []).filter(
                        (r: TModuleCommentReaction) => !(r.reaction === reaction && r.actor === currentUser?.id)
                      ),
                    }
                  : c
              ),
            { revalidate: false }
          );
        } catch {
          setToast({ type: "error", title: t("toast.error"), message: t("ui.reaction_remove_failed") });
        }
      },
      react: async (commentId, reaction, userReactions) => {
        if (userReactions.includes(reaction)) await operations.deleteCommentReaction(commentId, reaction);
        else await operations.addCommentReaction(commentId, reaction);
      },
      // reaction -> ids of the users who reacted with it
      reactionIds: (commentId) => {
        const comment = (comments ?? []).find((c) => c.id === commentId);
        const map: Record<string, string[]> = {};
        for (const r of (comment?.comment_reactions ?? []) as TModuleCommentReaction[]) {
          (map[r.reaction] ??= []).push(r.actor);
        }
        return map;
      },
      userReactions: (commentId) => {
        if (!currentUser?.id) return [];
        const comment = (comments ?? []).find((c) => c.id === commentId);
        return ((comment?.comment_reactions ?? []) as TModuleCommentReaction[])
          .filter((r) => r.actor === currentUser.id)
          .map((r) => r.reaction);
      },
      getReactionUsers: (reaction, reactionIds) =>
        formatTextList(
          (reactionIds?.[reaction] ?? [])
            .map((userId) => getUserDetails(userId)?.display_name)
            .filter((name): name is string => !!name)
        ),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceSlug, projectId, moduleId, mutate, t, comments, currentUser?.id, getUserDetails]
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
