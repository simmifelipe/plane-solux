/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { LockedOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import type { TMyResourceAccess, TResourceAccessKind } from "@plane/types";
// services
import { ResourceAccessService } from "@/services/resource-access.service";
// local imports
import { ResourceAccessModal } from "./resource-access-modal";

const resourceAccessService = new ResourceAccessService();

type Props = {
  workspaceSlug: string;
  projectId: string;
  kind: TResourceAccessKind;
  resourceId: string;
};

/**
 * Lock button that opens the access panel. Only project admins see it: the backend
 * reports that through `can_manage_access`, so the UI never guesses from roles.
 */
export const ResourceAccessControl = observer(function ResourceAccessControl(props: Props) {
  const { workspaceSlug, projectId, kind, resourceId } = props;
  const { t } = useTranslation();
  const [access, setAccess] = useState<TMyResourceAccess | undefined>();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resourceAccessService
      .getMyAccess(workspaceSlug, projectId, kind, resourceId)
      .then((data) => {
        if (!cancelled) setAccess(data);
        return data;
      })
      .catch(() => {
        if (!cancelled) setAccess(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, kind, resourceId]);

  if (!access?.can_manage_access) return null;

  return (
    <>
      <IconButton
        variant="ghost"
        size="md"
        icon={<Icon icon={LockedOutline} />}
        aria-label={t("resource_access.manage")}
        onClick={() => setIsOpen(true)}
      />
      <ResourceAccessModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onRestrictionChange={(isRestricted) =>
          setAccess((prev) => (prev ? { ...prev, is_restricted: isRestricted } : prev))
        }
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        kind={kind}
        resourceId={resourceId}
      />
    </>
  );
});
