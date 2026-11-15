/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import type { TMyResourceAccess, TResourceAccessKind } from "@plane/types";
import { ResourceAccessService } from "@/services/resource-access.service";

const resourceAccessService = new ResourceAccessService();

/**
 * What the current user may do with one module or work item. `undefined` while loading or
 * when the request fails: callers must then keep their normal role-based behaviour, since the
 * backend enforces the real rule either way.
 */
export const useMyResourceAccess = (
  workspaceSlug: string | undefined,
  projectId: string | undefined,
  kind: TResourceAccessKind,
  resourceId: string | undefined
): TMyResourceAccess | undefined => {
  const [access, setAccess] = useState<TMyResourceAccess | undefined>();

  useEffect(() => {
    if (!workspaceSlug || !projectId || !resourceId) return;
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

  return access;
};
