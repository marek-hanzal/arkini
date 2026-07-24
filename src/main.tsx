import { RegistryContext } from "@effect/atom-react";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { configureArkpackCatalogFx } from "~/bridge/arkpack/configureArkpackCatalogFx";
import { createArkpackCatalogFx } from "~/bridge/arkpack/createArkpackCatalogFx";
import { configureRendererLifecycleFx } from "~/bridge/lifecycle/configureRendererLifecycleFx";
import { createRendererLifecycleFx } from "~/bridge/lifecycle/createRendererLifecycleFx";
import { RendererAtomRegistry } from "~/bridge/reactivity/RendererAtomRegistry";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { installRendererControlledCloseFx } from "~/installRendererControlledCloseFx";
import { createArkiniRouterFx } from "~/createArkiniRouterFx";
import { AppearanceDataset } from "~/ui/appearance/AppearanceDataset";
import { configureLauncherStartupFx } from "~/ui/launcher/configureLauncherStartupFx";
import { LauncherHeroAsset } from "~/ui/launcher/LauncherHeroAsset";
import { LauncherStartupHydrator } from "~/ui/launcher/LauncherStartupHydrator";
import "~/ui/styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Arkini root element is missing.");
}

const catalog = RendererRuntime.runSync(createArkpackCatalogFx());
RendererRuntime.runSync(configureArkpackCatalogFx(catalog));
const lifecycle = RendererRuntime.runSync(createRendererLifecycleFx(window.arkini.lifecycle));
RendererRuntime.runSync(configureRendererLifecycleFx(lifecycle));
RendererRuntime.runSync(
	configureLauncherStartupFx({
		heroUrl: LauncherHeroAsset.url,
	}),
);
const router = RendererRuntime.runSync(
	createArkiniRouterFx({
		rendererRuntime: RendererRuntime,
	}),
);

RendererRuntime.runSync(
	installRendererControlledCloseFx({
		lifecycle: window.arkini.lifecycle,
		rendererRuntime: RendererRuntime,
		router,
	}),
);

createRoot(rootElement).render(
	<StrictMode>
		<RegistryContext.Provider value={RendererAtomRegistry}>
			<AppearanceDataset />
			<LauncherStartupHydrator />
			<RouterProvider router={router} />
		</RegistryContext.Provider>
	</StrictMode>,
);
