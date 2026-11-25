/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TModuleOrderByOptions =
  | "name"
  | "-name"
  | "priority"
  | "-priority"
  | "progress"
  | "-progress"
  | "issues_length"
  | "-issues_length"
  | "target_date"
  | "-target_date"
  | "created_at"
  | "-created_at"
  | "sort_order";

export type TModuleLayoutOptions = "list" | "kanban" | "board" | "gantt";

export type TModuleDisplayFilters = {
  favorites?: boolean;
  layout?: TModuleLayoutOptions;
  order_by?: TModuleOrderByOptions;
};

export type TModuleFilters = {
  lead?: string[] | null;
  members?: string[] | null;
  start_date?: string[] | null;
  status?: string[] | null;
  priority?: string[] | null;
  labels?: string[] | null;
  target_date?: string[] | null;
};

export type TModuleFiltersByState = {
  default: TModuleFilters;
  archived: TModuleFilters;
};

export type TModuleStoredFilters = {
  display_filters?: TModuleDisplayFilters;
  filters?: TModuleFilters;
};

// Solar: saved views of modules ("Visualizações de Demandas")
export type TModuleView = {
  id: string;
  name: string;
  description: string;
  filters: TModuleFilters;
  display_filters: TModuleDisplayFilters;
  logo_props?: any;
  access: number;
  owned_by: string;
  project: string;
  workspace: string;
  sort_order: number;
};
