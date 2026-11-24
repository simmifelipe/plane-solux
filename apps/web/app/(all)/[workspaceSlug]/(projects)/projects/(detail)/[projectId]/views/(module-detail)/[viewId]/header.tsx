/**
 * Solar: saved views of modules ("Visualizações de Demandas")
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { Header } from "@plane/blocks/layout";
import { ViewsOutline } from "@makeplane/propel/icons";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { CommonProjectBreadcrumbs } from "@/components/breadcrumbs/common";
import { useProjectCrumbProps } from "@/components/breadcrumbs/use-project-crumb-props";
import { useModuleView } from "@/components/modules/views";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useAppRouter } from "@/hooks/use-app-router";

export const ModuleViewDetailHeader = observer(function ModuleViewDetailHeader() {
  const { t } = useTranslation();
  const router = useAppRouter();
  const { workspaceSlug, projectId, viewId } = useParams();
  const slug = workspaceSlug?.toString() ?? "";
  const pid = projectId?.toString() ?? "";
  const projectCrumb = useProjectCrumbProps(slug, pid);
  const { loader } = useProject();
  const { data: view } = useModuleView(slug, pid, viewId?.toString() ?? "");

  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs isLoading={loader === "init-loader"}>
          <CommonProjectBreadcrumbs workspaceSlug={slug} projectId={pid} {...projectCrumb} />
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label={t("views")}
                href={`/${slug}/projects/${pid}/views/?tipo=demandas`}
                icon={<ViewsOutline className="h-4 w-4 text-tertiary" />}
              />
            }
          />
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label={view?.name ?? ""}
                icon={
                  view?.logo_props?.in_use ? (
                    <Logo logo={view.logo_props} size={16} type="lucide" />
                  ) : (
                    <ViewsOutline className="h-4 w-4 text-tertiary" />
                  )
                }
                isLast
              />
            }
            isLast
          />
        </Breadcrumbs>
      </Header.LeftItem>
      <Header.RightItem>
        <Button
          variant="secondary"
          size="md"
          stretch="auto"
          label={t("module_view.tab_modules")}
          onClick={() => router.push(`/${slug}/projects/${pid}/views?tipo=demandas`)}
        />
      </Header.RightItem>
    </Header>
  );
});
