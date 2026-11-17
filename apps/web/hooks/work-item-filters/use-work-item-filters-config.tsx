/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useMemo } from "react";
import {
  AtOutline,
  CalendarOutline,
  CyclesOutline,
  DueDateOutline,
  LabelsOutline,
  MembersOutline,
  ModuleOutline,
  PriorityOutline,
  ProjectsOutline,
  StartDateOutline,
  StateOutline,
  UserOutline,
} from "@makeplane/propel/icons";
// plane imports
import { Avatar } from "@makeplane/propel/components/avatar";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { CycleGroupIcon, PriorityIcon, StateGroupIcon } from "@plane/blocks/icons";
import { useTranslation } from "@plane/i18n";
import type {
  ICycle,
  IState,
  IUserLite,
  TFilterConfig,
  IIssueLabel,
  IModule,
  IProject,
  TWorkItemFilterProperty,
} from "@plane/types";

import {
  getAssigneeFilterConfig,
  getCreatedAtFilterConfig,
  getCreatedByFilterConfig,
  getCycleFilterConfig,
  getFileURL,
  getLabelFilterConfig,
  getMentionFilterConfig,
  getModuleFilterConfig,
  getPriorityFilterConfig,
  getProjectFilterConfig,
  getStartDateFilterConfig,
  getStateFilterConfig,
  getStateGroupFilterConfig,
  getSubscriberFilterConfig,
  getTargetDateFilterConfig,
  getUpdatedAtFilterConfig,
  isLoaderReady,
} from "@plane/utils";
// store hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useLabel } from "@/hooks/store/use-label";
import { useMember } from "@/hooks/store/use-member";
import { useModule } from "@/hooks/store/use-module";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
// plane web imports
import { useFiltersOperatorConfigs } from "@/hooks/rich-filters/use-filters-operator-configs";

export type TWorkItemFiltersEntityProps = {
  workspaceSlug: string;
  cycleIds?: string[];
  labelIds?: string[];
  memberIds?: string[];
  moduleIds?: string[];
  projectId?: string;
  projectIds?: string[];
  stateIds?: string[];
};

export type TUseWorkItemFiltersConfigProps = {
  allowedFilters: TWorkItemFilterProperty[];
} & TWorkItemFiltersEntityProps;

export type TWorkItemFiltersConfig = {
  areAllConfigsInitialized: boolean;
  configs: TFilterConfig<TWorkItemFilterProperty>[];
  configMap: {
    [key in TWorkItemFilterProperty]?: TFilterConfig<TWorkItemFilterProperty>;
  };
  isFilterEnabled: (key: TWorkItemFilterProperty) => boolean;
  members: IUserLite[];
};

export const useWorkItemFiltersConfig = (props: TUseWorkItemFiltersConfigProps): TWorkItemFiltersConfig => {
  const { allowedFilters, cycleIds, labelIds, memberIds, moduleIds, projectId, projectIds, stateIds, workspaceSlug } =
    props;
  // store hooks
  const { loader: projectLoader, getProjectById } = useProject();
  const { getCycleById } = useCycle();
  const { getLabelById } = useLabel();
  const { getModuleById } = useModule();
  const { getStateById } = useProjectState();
  const { getUserDetails } = useMember();
  const { t, currentLocale } = useTranslation();
  // derived values
  const operatorConfigs = useFiltersOperatorConfigs({ workspaceSlug });
  const filtersToShow = useMemo(() => new Set(allowedFilters), [allowedFilters]);
  const project = useMemo(() => getProjectById(projectId), [projectId, getProjectById]);
  const members: IUserLite[] | undefined = useMemo(
    () =>
      memberIds
        ? (memberIds.map((memberId) => getUserDetails(memberId)).filter((member) => member) as IUserLite[])
        : undefined,
    [memberIds, getUserDetails]
  );
  const workItemStates: IState[] | undefined = useMemo(
    () =>
      stateIds ? (stateIds.map((stateId) => getStateById(stateId)).filter((state) => state) as IState[]) : undefined,
    [stateIds, getStateById]
  );
  const workItemLabels: IIssueLabel[] | undefined = useMemo(
    () =>
      labelIds
        ? (labelIds.map((labelId) => getLabelById(labelId)).filter((label) => label) as IIssueLabel[])
        : undefined,
    [labelIds, getLabelById]
  );
  const cycles = useMemo(
    () => (cycleIds ? (cycleIds.map((cycleId) => getCycleById(cycleId)).filter((cycle) => cycle) as ICycle[]) : []),
    [cycleIds, getCycleById]
  );
  const modules = useMemo(
    () =>
      moduleIds ? (moduleIds.map((moduleId) => getModuleById(moduleId)).filter((module) => module) as IModule[]) : [],
    [moduleIds, getModuleById]
  );
  const projects = useMemo(
    () =>
      projectIds
        ? (projectIds.map((projectId) => getProjectById(projectId)).filter((project) => project) as IProject[])
        : [],
    [projectIds, getProjectById]
  );
  const areAllConfigsInitialized = useMemo(() => isLoaderReady(projectLoader), [projectLoader]);

  /**
   * Checks if a filter is enabled based on the filters to show.
   * @param key - The filter key.
   * @param level - The level of the filter.
   * @returns True if the filter is enabled, false otherwise.
   */
  const isFilterEnabled = useCallback((key: TWorkItemFilterProperty) => filtersToShow.has(key), [filtersToShow]);

  // state group filter config
  const stateGroupFilterConfig = useMemo(
    () =>
      ({
        ...getStateGroupFilterConfig<TWorkItemFilterProperty>("state_group")({
          isEnabled: isFilterEnabled("state_group"),
          filterIcon: StateOutline,
          getOptionIcon: (stateGroupKey) => <StateGroupIcon stateGroup={stateGroupKey} />,
          getOptionLabel: (stateGroup) => t(`workspace_projects.state.${stateGroup}`),
          ...operatorConfigs,
        }),
        label: t("common.state_group"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is re-created every render; the locale is the real dependency
    [isFilterEnabled, operatorConfigs, currentLocale]
  );

  // state filter config
  const stateFilterConfig = useMemo(
    () =>
      ({
        ...getStateFilterConfig<TWorkItemFilterProperty>("state_id")({
          isEnabled: isFilterEnabled("state_id") && workItemStates !== undefined,
          filterIcon: StateOutline,
          getOptionIcon: (state) => <StateGroupIcon stateGroup={state.group} color={state.color} />,
          states: workItemStates ?? [],
          ...operatorConfigs,
        }),
        label: t("common.state"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is re-created every render; the locale is the real dependency
    [isFilterEnabled, workItemStates, operatorConfigs, currentLocale]
  );

  // label filter config
  const labelFilterConfig = useMemo(
    () =>
      ({
        ...getLabelFilterConfig<TWorkItemFilterProperty>("label_id")({
          isEnabled: isFilterEnabled("label_id") && workItemLabels !== undefined,
          filterIcon: LabelsOutline,
          labels: workItemLabels ?? [],
          getOptionIcon: (color) => (
            <span className="flex size-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
          ),
          ...operatorConfigs,
        }),
        label: t("common.label"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is re-created every render; the locale is the real dependency
    [isFilterEnabled, workItemLabels, operatorConfigs, currentLocale]
  );

  // cycle filter config
  const cycleFilterConfig = useMemo(
    () =>
      ({
        ...getCycleFilterConfig<TWorkItemFilterProperty>("cycle_id")({
          isEnabled: isFilterEnabled("cycle_id") && project?.cycle_view === true && cycles !== undefined,
          filterIcon: CyclesOutline,
          getOptionIcon: (cycleGroup) => <CycleGroupIcon cycleGroup={cycleGroup} className="h-3.5 w-3.5 flex-shrink-0" />,
          cycles: cycles ?? [],
          ...operatorConfigs,
        }),
        label: t("common.cycle"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is re-created every render; the locale is the real dependency
    [isFilterEnabled, project?.cycle_view, cycles, operatorConfigs, currentLocale]
  );

  // module filter config
  const moduleFilterConfig = useMemo(
    () =>
      ({
        ...getModuleFilterConfig<TWorkItemFilterProperty>("module_id")({
          isEnabled: isFilterEnabled("module_id") && project?.module_view === true && modules !== undefined,
          filterIcon: ModuleOutline,
          getOptionIcon: () => <ModuleOutline className="h-3 w-3 flex-shrink-0" />,
          modules: modules ?? [],
          ...operatorConfigs,
        }),
        label: t("common.module"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is re-created every render; the locale is the real dependency
    [isFilterEnabled, project?.module_view, modules, operatorConfigs, currentLocale]
  );

  // assignee filter config
  const assigneeFilterConfig = useMemo(
    () =>
      ({
        ...getAssigneeFilterConfig<TWorkItemFilterProperty>("assignee_id")({
          isEnabled: isFilterEnabled("assignee_id") && members !== undefined,
          filterIcon: MembersOutline,
          members: members ?? [],
          getOptionIcon: (memberDetails) => (
            <Avatar
              alt={memberDetails.display_name}
              fallback={memberDetails.display_name?.[0]?.toUpperCase()}
              src={getFileURL(memberDetails.avatar_url)}
              size="2xs"
            />
          ),
          ...operatorConfigs,
        }),
        label: t("common.assignees"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is re-created every render; the locale is the real dependency
    [isFilterEnabled, members, operatorConfigs, currentLocale]
  );

  // mention filter config
  const mentionFilterConfig = useMemo(
    () =>
      ({
        ...getMentionFilterConfig<TWorkItemFilterProperty>("mention_id")({
          isEnabled: isFilterEnabled("mention_id") && members !== undefined,
          filterIcon: AtOutline,
          members: members ?? [],
          getOptionIcon: (memberDetails) => (
            <Avatar
              alt={memberDetails.display_name}
              fallback={memberDetails.display_name?.[0]?.toUpperCase()}
              src={getFileURL(memberDetails.avatar_url)}
              size="2xs"
            />
          ),
          ...operatorConfigs,
        }),
        label: t("mentions"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is re-created every render; the locale is the real dependency
    [isFilterEnabled, members, operatorConfigs, currentLocale]
  );

  // created by filter config
  const createdByFilterConfig = useMemo(
    () =>
      ({
        ...getCreatedByFilterConfig<TWorkItemFilterProperty>("created_by_id")({
          isEnabled: isFilterEnabled("created_by_id") && members !== undefined,
          filterIcon: UserOutline,
          members: members ?? [],
          getOptionIcon: (memberDetails) => (
            <Avatar
              alt={memberDetails.display_name}
              fallback={memberDetails.display_name?.[0]?.toUpperCase()}
              src={getFileURL(memberDetails.avatar_url)}
              size="2xs"
            />
          ),
          ...operatorConfigs,
        }),
        label: t("common.created_by"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is re-created every render; the locale is the real dependency
    [isFilterEnabled, members, operatorConfigs, currentLocale]
  );

  // subscriber filter config
  const subscriberFilterConfig = useMemo(
    () =>
      ({
        ...getSubscriberFilterConfig<TWorkItemFilterProperty>("subscriber_id")({
          isEnabled: isFilterEnabled("subscriber_id") && members !== undefined,
          filterIcon: MembersOutline,
          members: members ?? [],
          getOptionIcon: (memberDetails) => (
            <Avatar
              alt={memberDetails.display_name}
              fallback={memberDetails.display_name?.[0]?.toUpperCase()}
              src={getFileURL(memberDetails.avatar_url)}
              size="2xs"
            />
          ),
          ...operatorConfigs,
        }),
        label: t("ui.filter_subscriber"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is re-created every render; the locale is the real dependency
    [isFilterEnabled, members, operatorConfigs, currentLocale]
  );

  // priority filter config
  const priorityFilterConfig = useMemo(
    () =>
      ({
        ...getPriorityFilterConfig<TWorkItemFilterProperty>("priority")({
          isEnabled: isFilterEnabled("priority"),
          filterIcon: PriorityOutline,
          getOptionIcon: (priority) => <PriorityIcon priority={priority} />,
          getOptionLabel: (priority) => (priority === "none" ? t("common.none") : t(`issue.priority.${priority}`)),
          ...operatorConfigs,
        }),
        label: t("common.priority"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is re-created every render; the locale is the real dependency
    [isFilterEnabled, operatorConfigs, currentLocale]
  );

  // start date filter config
  const startDateFilterConfig = useMemo(
    () =>
      ({
        ...getStartDateFilterConfig<TWorkItemFilterProperty>("start_date")({
          isEnabled: true,
          filterIcon: StartDateOutline,
          ...operatorConfigs,
        }),
        label: t("start_date"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is re-created every render; the locale is the real dependency
    [operatorConfigs, currentLocale]
  );

  // target date filter config
  const targetDateFilterConfig = useMemo(
    () =>
      ({
        ...getTargetDateFilterConfig<TWorkItemFilterProperty>("target_date")({
          isEnabled: true,
          filterIcon: DueDateOutline,
          ...operatorConfigs,
        }),
        label: t("target_date"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is re-created every render; the locale is the real dependency
    [operatorConfigs, currentLocale]
  );

  // created at filter config
  const createdAtFilterConfig = useMemo(
    () =>
      ({
        ...getCreatedAtFilterConfig<TWorkItemFilterProperty>("created_at")({
          isEnabled: true,
          filterIcon: CalendarOutline,
          ...operatorConfigs,
        }),
        label: t("common.created_at"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is re-created every render; the locale is the real dependency
    [operatorConfigs, currentLocale]
  );

  // updated at filter config
  const updatedAtFilterConfig = useMemo(
    () =>
      ({
        ...getUpdatedAtFilterConfig<TWorkItemFilterProperty>("updated_at")({
          isEnabled: true,
          filterIcon: CalendarOutline,
          ...operatorConfigs,
        }),
        label: t("common.updated_at"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is re-created every render; the locale is the real dependency
    [operatorConfigs, currentLocale]
  );

  // project filter config
  const projectFilterConfig = useMemo(
    () =>
      ({
        ...getProjectFilterConfig<TWorkItemFilterProperty>("project_id")({
          isEnabled: isFilterEnabled("project_id") && projects !== undefined,
          filterIcon: ProjectsOutline,
          projects: projects,
          getOptionIcon: (project) => <Logo logo={project.logo_props} size={12} />,
          ...operatorConfigs,
        }),
        label: t("common.projects"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is re-created every render; the locale is the real dependency
    [isFilterEnabled, projects, operatorConfigs, currentLocale]
  );

  return {
    areAllConfigsInitialized,
    configs: [
      stateFilterConfig,
      stateGroupFilterConfig,
      assigneeFilterConfig,
      priorityFilterConfig,
      projectFilterConfig,
      mentionFilterConfig,
      labelFilterConfig,
      cycleFilterConfig,
      moduleFilterConfig,
      startDateFilterConfig,
      targetDateFilterConfig,
      createdAtFilterConfig,
      updatedAtFilterConfig,
      createdByFilterConfig,
      subscriberFilterConfig,
    ],
    configMap: {
      project_id: projectFilterConfig,
      state_group: stateGroupFilterConfig,
      state_id: stateFilterConfig,
      label_id: labelFilterConfig,
      cycle_id: cycleFilterConfig,
      module_id: moduleFilterConfig,
      assignee_id: assigneeFilterConfig,
      mention_id: mentionFilterConfig,
      created_by_id: createdByFilterConfig,
      subscriber_id: subscriberFilterConfig,
      priority: priorityFilterConfig,
      start_date: startDateFilterConfig,
      target_date: targetDateFilterConfig,
      created_at: createdAtFilterConfig,
      updated_at: updatedAtFilterConfig,
    },
    isFilterEnabled,
    members: members ?? [],
  };
};
