/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type {
  TMyResourceAccess,
  TResourceAccessGrant,
  TResourceAccessGrantPayload,
  TResourceAccessKind,
  TResourceAccessState,
} from "@plane/types";
// services
import { APIService } from "@/services/api.service";

/** Manages who can view / comment on / edit a restricted module or work item. */
export class ResourceAccessService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private path(workspaceSlug: string, projectId: string, kind: TResourceAccessKind, resourceId: string) {
    const segment = kind === "module" ? "modules" : "issues";
    return `/api/workspaces/${workspaceSlug}/projects/${projectId}/${segment}/${resourceId}`;
  }

  async getMyAccess(
    workspaceSlug: string,
    projectId: string,
    kind: TResourceAccessKind,
    resourceId: string
  ): Promise<TMyResourceAccess> {
    return this.get(`${this.path(workspaceSlug, projectId, kind, resourceId)}/my-access/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getAccess(
    workspaceSlug: string,
    projectId: string,
    kind: TResourceAccessKind,
    resourceId: string
  ): Promise<TResourceAccessState> {
    return this.get(`${this.path(workspaceSlug, projectId, kind, resourceId)}/access/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async setRestricted(
    workspaceSlug: string,
    projectId: string,
    kind: TResourceAccessKind,
    resourceId: string,
    isRestricted: boolean
  ): Promise<TResourceAccessState> {
    return this.patch(`${this.path(workspaceSlug, projectId, kind, resourceId)}/access/`, {
      is_restricted: isRestricted,
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async saveGrant(
    workspaceSlug: string,
    projectId: string,
    kind: TResourceAccessKind,
    resourceId: string,
    data: TResourceAccessGrantPayload
  ): Promise<TResourceAccessGrant> {
    return this.post(`${this.path(workspaceSlug, projectId, kind, resourceId)}/access/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async removeGrant(
    workspaceSlug: string,
    projectId: string,
    kind: TResourceAccessKind,
    resourceId: string,
    userId: string
  ): Promise<void> {
    return this.delete(`${this.path(workspaceSlug, projectId, kind, resourceId)}/access/${userId}/`)
      .then(() => undefined)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
