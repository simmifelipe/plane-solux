/**
 * Solar: saved views of modules ("Visualizações de Demandas")
 */

import { observer } from "mobx-react";
import { useParams, useSearchParams } from "next/navigation";
import { Tab, Tabs, TabsList } from "@makeplane/propel/components/tabs";
import { useTranslation } from "@plane/i18n";
import { useAppRouter } from "@/hooks/use-app-router";

export const MODULE_VIEWS_TAB_PARAM = "tipo";
export const MODULE_VIEWS_TAB_VALUE = "demandas";

/** Hook: whether the views page is showing the module ("Demandas") views tab. */
export const useIsModuleViewsTab = () => {
  const searchParams = useSearchParams();
  return searchParams.get(MODULE_VIEWS_TAB_PARAM) === MODULE_VIEWS_TAB_VALUE;
};

export const ViewsTypeTabs = observer(function ViewsTypeTabs() {
  const { t } = useTranslation();
  const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();
  const isModules = useIsModuleViewsTab();
  const base = `/${workspaceSlug}/projects/${projectId}/views`;

  return (
    <Tabs value={isModules ? "modules" : "work-items"} variant="contained" stretch="auto">
      <TabsList aria-label={t("views")}>
        <Tab value="work-items" label={t("module_view.tab_work_items")} onClick={() => router.push(base)} />
        <Tab
          value="modules"
          label={t("module_view.tab_modules")}
          onClick={() => router.push(`${base}?${MODULE_VIEWS_TAB_PARAM}=${MODULE_VIEWS_TAB_VALUE}`)}
        />
      </TabsList>
    </Tabs>
  );
});
