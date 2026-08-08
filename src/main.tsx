// Installs Pixi's static shader/uniform synchronizers before the renderer graph
// is evaluated so Electron can keep its strict no-unsafe-eval CSP.
import "pixi.js/unsafe-eval";
import { RegistryContext } from "@effect/atom-react";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ArkiniWindowTitle } from "../shared/ArkiniAppMetadata";
import { configureArkpackCatalogFx } from "~/bridge/arkpack/configureArkpackCatalogFx";
import { createArkpackCatalogFx } from "~/bridge/arkpack/createArkpackCatalogFx";
import { configureRendererLifecycleFx } from "~/bridge/lifecycle/configureRendererLifecycleFx";
import { createRendererLifecycleFx } from "~/bridge/lifecycle/createRendererLifecycleFx";
import { RendererAtomRegistry } from "~/bridge/reactivity/RendererAtomRegistry";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { installRendererControlledCloseFx } from "~/installRendererControlledCloseFx";
import { installRendererNativeDragGuardFx } from "~/installRendererNativeDragGuardFx";
import { installWindowModeSyncFx } from "~/bridge/window/installWindowModeSyncFx";
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
document.title = ArkiniWindowTitle;

/**
 * Renderer composition root. Every owner built here has process lifetime and
 * must exist before React consumers mount; StrictMode remounts must never
 * duplicate the registry, runtime-backed authorities or native close listeners.
 */
const catalog = RendererRuntime.runSync(createArkpackCatalogFx());
RendererRuntime.runSync(configureArkpackCatalogFx(catalog));
RendererRuntime.runSync(
	installRendererNativeDragGuardFx({
		root: rootElement,
	}),
);
const lifecycle = RendererRuntime.runSync(createRendererLifecycleFx(window.arkini.lifecycle));
RendererRuntime.runSync(configureRendererLifecycleFx(lifecycle));
RendererRuntime.runSync(installWindowModeSyncFx());
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
// Install the native handshake once at the process boundary, outside React ownership.
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
