/**
 * Solar: saved views of modules ("Visualizações de Demandas")
 */

import useSWR from "swr";
import { moduleViewService } from "@/services/module-view.service";

export const moduleViewsKey = (workspaceSlug: string, projectId: string) =>
  `MODULE_VIEWS_${workspaceSlug}_${projectId}`;

export const moduleViewKey = (workspaceSlug: string, projectId: string, viewId: string) =>
  `MODULE_VIEW_${workspaceSlug}_${projectId}_${viewId}`;

export const useModuleViews = (workspaceSlug: string, projectId: string) =>
  useSWR(workspaceSlug && projectId ? moduleViewsKey(workspaceSlug, projectId) : null, () =>
    moduleViewService.list(workspaceSlug, projectId)
  );

export const useModuleView = (workspaceSlug: string, projectId: string, viewId: string) =>
  useSWR(workspaceSlug && projectId && viewId ? moduleViewKey(workspaceSlug, projectId, viewId) : null, () =>
    moduleViewService.retrieve(workspaceSlug, projectId, viewId)
  );
