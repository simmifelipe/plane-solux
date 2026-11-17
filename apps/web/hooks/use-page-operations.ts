/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
// plane imports
import { IS_FAVORITE_MENU_OPEN } from "@plane/constants";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import { EPageAccess } from "@plane/types";
import { copyUrlToClipboard } from "@plane/utils";
// hooks
import { useCollaborativePageActions } from "@/hooks/use-collaborative-page-actions";
// store types
import type { TPageInstance } from "@/store/pages/base-page";
// local storage
import useLocalStorage from "./use-local-storage";

export type TPageOperations = {
  toggleLock: () => void;
  toggleAccess: () => void;
  toggleFavorite: () => void;
  openInNewTab: () => void;
  copyLink: () => void;
  duplicate: () => void;
  toggleArchive: () => void;
};

type Props = {
  page: TPageInstance;
};

export const usePageOperations = (
  props: Props
): {
  pageOperations: TPageOperations;
} => {
  const { page } = props;
  // derived values
  const {
    access,
    addToFavorites,
    archived_at,
    duplicate,
    is_favorite,
    is_locked,
    getRedirectionLink,
    removePageFromFavorites,
  } = page;
  // translation
  const { t } = useTranslation();
  // collaborative actions
  const { executeCollaborativeAction } = useCollaborativePageActions(props);
  // local storage
  const { setValue: toggleFavoriteMenu, storedValue: isFavoriteMenuOpen } = useLocalStorage<boolean>(
    IS_FAVORITE_MENU_OPEN,
    false
  );
  // page operations
  const pageOperations: TPageOperations = useMemo(() => {
    const pageLink = getRedirectionLink();

    return {
      copyLink: async () => {
        await copyUrlToClipboard(pageLink);
        setToast({
          type: "success",
          title: t("ui.link_copied"),
          message: t("wiki_collections.list.page_link_copied"),
        });
      },
      duplicate: async () => {
        try {
          await duplicate();
          setToast({
            type: "success",
            title: t("toast.success"),
            message: t("ui.page_duplicated_successfully"),
          });
        } catch (_error) {
          setToast({
            type: "error",
            title: t("toast.error"),
            message: t("ui.page_could_not_be_duplicated"),
          });
        }
      },
      move: async () => {},
      openInNewTab: () => window.open(pageLink, "_blank"),
      toggleAccess: async () => {
        const changedPageType =
          access === EPageAccess.PUBLIC ? t("ui.page_access_private_lower") : t("ui.page_access_public_lower");
        try {
          if (access === EPageAccess.PUBLIC)
            await executeCollaborativeAction({ type: "sendMessageToServer", message: "make-private" });
          else await executeCollaborativeAction({ type: "sendMessageToServer", message: "make-public" });
          setToast({
            type: "success",
            title: t("toast.success"),
            message: t("ui.page_marked_access_and_moved", { access: changedPageType }),
          });
        } catch (_error) {
          setToast({
            type: "error",
            title: t("toast.error"),
            message: t("ui.page_could_not_be_marked_access", { access: changedPageType }),
          });
        }
      },
      toggleArchive: async () => {
        if (archived_at) {
          try {
            await executeCollaborativeAction({ type: "sendMessageToServer", message: "unarchive" });
            setToast({
              type: "success",
              title: t("toast.success"),
              message: t("ui.page_restored_successfully"),
            });
          } catch (_error) {
            setToast({
              type: "error",
              title: t("toast.error"),
              message: t("ui.page_could_not_be_restored"),
            });
          }
        } else {
          try {
            await executeCollaborativeAction({ type: "sendMessageToServer", message: "archive" });
            setToast({
              type: "success",
              title: t("toast.success"),
              message: t("ui.page_archived_successfully"),
            });
          } catch (_error) {
            setToast({
              type: "error",
              title: t("toast.error"),
              message: t("ui.page_could_not_be_archived"),
            });
          }
        }
      },
      toggleFavorite: async () => {
        if (is_favorite) {
          try {
            await removePageFromFavorites();
            setToast({
              type: "success",
              title: t("toast.success"),
              message: t("ui.page_removed_from_favorites"),
            });
          } catch (_error) {
            setToast({
              type: "error",
              title: t("toast.error"),
              message: t("ui.page_could_not_be_removed_from_favorites"),
            });
          }
        } else {
          try {
            await addToFavorites();
            if (!isFavoriteMenuOpen) toggleFavoriteMenu(true);
            setToast({
              type: "success",
              title: t("toast.success"),
              message: t("ui.page_added_to_favorites"),
            });
          } catch (_error) {
            setToast({
              type: "error",
              title: t("toast.error"),
              message: t("ui.page_could_not_be_added_to_favorites"),
            });
          }
        }
      },
      toggleLock: async () => {
        if (is_locked) {
          try {
            await executeCollaborativeAction({ type: "sendMessageToServer", message: "unlock" });
            setToast({
              type: "success",
              title: t("toast.success"),
              message: t("ui.page_unlocked_successfully"),
            });
          } catch (_error) {
            setToast({
              type: "error",
              title: t("toast.error"),
              message: t("ui.page_could_not_be_unlocked"),
            });
          }
        } else {
          try {
            await executeCollaborativeAction({ type: "sendMessageToServer", message: "lock" });
            setToast({
              type: "success",
              title: t("toast.success"),
              message: t("ui.page_locked_successfully"),
            });
          } catch (_error) {
            setToast({
              type: "error",
              title: t("toast.error"),
              message: t("ui.page_could_not_be_locked"),
            });
          }
        }
      },
    };
  }, [
    access,
    addToFavorites,
    archived_at,
    duplicate,
    executeCollaborativeAction,
    getRedirectionLink,
    is_favorite,
    is_locked,
    isFavoriteMenuOpen,
    removePageFromFavorites,
    t,
    toggleFavoriteMenu,
  ]);
  return {
    pageOperations,
  };
};
