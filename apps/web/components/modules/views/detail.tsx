/**
 * Solar: saved views of modules ("Visualizações de Demandas")
 * Body of a module view: applies the saved filters to the project modules (list or board).
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ContentWrapper, Row, ERowVariant } from "@plane/blocks/layout";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";
import { useTranslation } from "@plane/i18n";
import type { TModuleView } from "@plane/types";
import { orderModules, shouldFilterModule } from "@plane/utils";
// components
import { ListLayout } from "@/components/core/list";
import { ModuleCardItem } from "@/components/modules/module-card-item";
import { ModuleListItem } from "@/components/modules/module-list-item";
import { ModulePeekOverview } from "@/components/modules/module-peek-overview";
import { CycleModuleBoardLayoutLoader } from "@/components/ui/loader/cycle-module-board-loader";
import { CycleModuleListLayoutLoader } from "@/components/ui/loader/cycle-module-list-loader";
// hooks
import { useModule } from "@/hooks/store/use-module";

type Props = {
  view: TModuleView;
  searchQuery?: string;
};

export const ModuleViewModules = observer(function ModuleViewModules({ view, searchQuery = "" }: Props) {
  const { workspaceSlug, projectId } = useParams();
  const slug = workspaceSlug?.toString() ?? "";
  const pid = projectId?.toString() ?? "";
  const { t } = useTranslation();
  const { fetchModules, getProjectModuleDetails } = useModule();
  const [loaded, setLoaded] = useState(false);

  useSWR(slug && pid ? `MODULE_VIEW_MODULES_${slug}_${pid}` : null, async () => {
    await fetchModules(slug, pid);
    setLoaded(true);
  });
  useEffect(() => setLoaded(false), [pid]);

  const layout = view.display_filters?.layout === "board" ? "board" : "list";
  const projectModules = getProjectModuleDetails(pid);

  const moduleIds = useMemo(() => {
    if (!projectModules) return null;
    const query = searchQuery.toLowerCase();
    const filtered = projectModules.filter(
      (m) =>
        m.name.toLowerCase().includes(query) && shouldFilterModule(m, view.display_filters ?? {}, view.filters ?? {})
    );
    return orderModules(filtered, view.display_filters?.order_by ?? "name").map((m) => m.id);
  }, [projectModules, searchQuery, view.display_filters, view.filters]);

  if (!loaded || !moduleIds)
    return layout === "board" ? <CycleModuleBoardLayoutLoader /> : <CycleModuleListLayoutLoader />;

  if (moduleIds.length === 0)
    return (
      <EmptyStateDetailed
        assetKey="search"
        title={t("common_empty_state.search.title")}
        description={t("common_empty_state.search.description")}
      />
    );

  return (
    <ContentWrapper variant={ERowVariant.HUGGING}>
      <div className="flex size-full justify-between">
        {layout === "list" ? (
          <ListLayout>
            {moduleIds.map((id) => (
              <ModuleListItem key={id} moduleId={id} />
            ))}
          </ListLayout>
        ) : (
          <Row className="grid size-full grid-cols-1 gap-6 overflow-y-auto py-page-y lg:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 vertical-scrollbar scrollbar-lg auto-rows-max transition-all">
            {moduleIds.map((id) => (
              <ModuleCardItem key={id} moduleId={id} />
            ))}
          </Row>
        )}
        <div className="flex-shrink-0">
          <ModulePeekOverview projectId={pid} workspaceSlug={slug} />
        </div>
      </div>
    </ContentWrapper>
  );
});
