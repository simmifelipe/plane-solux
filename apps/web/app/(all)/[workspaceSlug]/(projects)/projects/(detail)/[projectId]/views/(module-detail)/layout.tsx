/**
 * Solar: saved views of modules ("Visualizações de Demandas")
 */

import { Outlet } from "react-router";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
// local components
import { ModuleViewDetailHeader } from "./[viewId]/header";

export default function ModuleViewDetailLayout() {
  return (
    <>
      <AppHeader header={<ModuleViewDetailHeader />} />
      <ContentWrapper>
        <Outlet />
      </ContentWrapper>
    </>
  );
}
