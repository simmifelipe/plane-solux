/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TResourceAccessKind = "module" | "issue";

/** One user's grant on a restricted module or work item. comment/edit imply view. */
export type TResourceAccessGrant = {
  id: string;
  user_id: string;
  can_view: boolean;
  can_comment: boolean;
  can_edit: boolean;
};

export type TResourceAccessState = {
  is_restricted: boolean;
  grants: TResourceAccessGrant[];
};

export type TResourceAccessGrantPayload = {
  user_id: string;
  can_view?: boolean;
  can_comment?: boolean;
  can_edit?: boolean;
};

/** What the current user may do with one module or work item (`my-access` endpoint). */
export type TMyResourceAccess = {
  is_restricted: boolean;
  can_view: boolean;
  can_comment: boolean;
  can_edit: boolean;
  can_manage_access: boolean;
};
