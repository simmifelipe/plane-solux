/**
 * Solar: saved views of modules ("Visualizações de Demandas")
 */

import { API_BASE_URL } from "@plane/constants";
import type { TModuleView } from "@plane/types";
import { APIService } from "@/services/api.service";

export class ModuleViewService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private base(workspaceSlug: string, projectId: string) {
    return `/api/workspaces/${workspaceSlug}/projects/${projectId}/module-views/`;
  }

  async list(workspaceSlug: string, projectId: string): Promise<TModuleView[]> {
    return this.get(this.base(workspaceSlug, projectId))
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async retrieve(workspaceSlug: string, projectId: string, viewId: string): Promise<TModuleView> {
    return this.get(`${this.base(workspaceSlug, projectId)}${viewId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async create(workspaceSlug: string, projectId: string, data: Partial<TModuleView>): Promise<TModuleView> {
    return this.post(this.base(workspaceSlug, projectId), data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    viewId: string,
    data: Partial<TModuleView>
  ): Promise<TModuleView> {
    return this.patch(`${this.base(workspaceSlug, projectId)}${viewId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async remove(workspaceSlug: string, projectId: string, viewId: string): Promise<void> {
    return this.delete(`${this.base(workspaceSlug, projectId)}${viewId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}

export const moduleViewService = new ModuleViewService();
