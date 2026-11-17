/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { setPromiseToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { IProject } from "@plane/types";
import {
  CyclesOutline,
  IntakeOutline,
  ModuleOutline,
  PagesOutline,
  ViewsOutline,
  WorkItemsOutline,
} from "@makeplane/propel/icons";
// components
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
import { SettingsHeading } from "@/components/settings/heading";
// hooks
import { useProject } from "@/hooks/store/use-project";
// plane web imports
import { UpgradeBadge } from "@/components/workspace/upgrade-badge";
// local imports
import { ProjectFeatureToggle } from "./helper";

type Props = {
  workspaceSlug: string;
  projectId: string;
  isAdmin: boolean;
};

// Solar: labelKey usa os nomes do menu do projeto (Tarefas, Demandas, Anotações, Requisições)
const PROJECT_FEATURES_LIST: Record<
  string,
  {
    key: string;
    labelKey?: string;
    property: string;
    title: string;
    description: string;
    icon: ReactNode;
    isPro: boolean;
    isEnabled: boolean;
  }
> = {
  work_items: {
    key: "work_items",
    labelKey: "sidebar.work_items",
    property: "work_item_view",
    title: "Work items",
    description: "Show or hide the work items entry in the project menu.",
    icon: <WorkItemsOutline className="h-5 w-5 flex-shrink-0 text-tertiary" />,
    isPro: false,
    isEnabled: true,
  },
  cycles: {
    key: "cycles",
    property: "cycle_view",
    title: "Cycles",
    description: "Timebox work as you see fit per project and change frequency from one period to the next.",
    icon: <CyclesOutline className="h-5 w-5 flex-shrink-0 rotate-180 text-tertiary" />,
    isPro: false,
    isEnabled: true,
  },
  modules: {
    key: "modules",
    labelKey: "sidebar.modules",
    property: "module_view",
    title: "Modules",
    description: "Group work into sub-project-like set-ups with their own leads and assignees.",
    icon: <ModuleOutline width={20} height={20} className="flex-shrink-0 text-tertiary" />,
    isPro: false,
    isEnabled: true,
  },
  views: {
    key: "views",
    property: "issue_views_view",
    title: "Views",
    description: "Save sorts, filters, and display options for later or share them.",
    icon: <ViewsOutline className="h-5 w-5 flex-shrink-0 text-tertiary" />,
    isPro: false,
    isEnabled: true,
  },
  pages: {
    key: "pages",
    labelKey: "sidebar.pages",
    property: "page_view",
    title: "Pages",
    description: "Write anything like you write anything.",
    icon: <PagesOutline className="h-5 w-5 flex-shrink-0 text-tertiary" />,
    isPro: false,
    isEnabled: true,
  },
  inbox: {
    key: "intake",
    labelKey: "sidebar.intake",
    property: "inbox_view",
    title: "Intake",
    description: "Consider and discuss work items before you add them to your project.",
    icon: <IntakeOutline className="h-5 w-5 flex-shrink-0 text-tertiary" />,
    isPro: false,
    isEnabled: true,
  },
};

export const ProjectFeaturesList = observer(function ProjectFeaturesList(props: Props) {
  const { workspaceSlug, projectId, isAdmin } = props;
  // store hooks
  const { t } = useTranslation();
  const { getProjectById, updateProject } = useProject();
  // derived values
  const currentProjectDetails = getProjectById(projectId);
  // Solar: work_item_view nasce true (default do banco); trata ausência como ligado
  const getFeatureValue = (property: string) =>
    property === "work_item_view"
      ? (currentProjectDetails?.work_item_view ?? true)
      : Boolean(currentProjectDetails?.[property as keyof IProject]);

  const handleSubmit = (_featureKey: string, featureProperty: string) => {
    if (!workspaceSlug || !projectId || !currentProjectDetails) return;

    // making the request to update the project feature
    const settingsPayload = {
      [featureProperty]: !getFeatureValue(featureProperty),
    };
    const updateProjectPromise = updateProject(workspaceSlug, projectId, settingsPayload);

    setPromiseToast(updateProjectPromise, {
      loading: t("project_settings.features.toasts.loading"),
      success: {
        title: t("toast.success"),
        message: () => t("project_settings.features.toasts.success"),
      },
      error: {
        title: t("toast.error"),
        message: () => t("project_settings.features.toasts.error"),
      },
    });
  };

  return (
    <section className="flex flex-col gap-y-4">
      <SettingsHeading
        title={t("projects_and_issues")}
        description={t("projects_and_issues_description")}
        variant="h5"
      />
      {Object.entries(PROJECT_FEATURES_LIST).map(([featureItemKey, featureItem]) => (
        <SettingsBoxedControlItem
          key={featureItemKey}
          title={
            <span>
              {t("common.actions.enable")} <span className="lowercase">{t(featureItem.labelKey ?? featureItem.key)}</span>
            </span>
          }
          titleAccessory={
            featureItem.isPro ? (
              <Tooltip label={t("ui.pro_feature")}>
                <UpgradeBadge className="rounded-sm" />
              </Tooltip>
            ) : undefined
          }
          description={t(`${featureItem.key}_description`)}
          control={
            <ProjectFeatureToggle
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              featureItem={featureItem}
              value={getFeatureValue(featureItem.property)}
              handleSubmit={handleSubmit}
              disabled={!isAdmin}
            />
          }
        />
      ))}
    </section>
  );
});
