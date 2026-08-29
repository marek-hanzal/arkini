// Installs Pixi's static shader/uniform synchronizers before the renderer graph
// is evaluated so Electron can keep its strict no-unsafe-eval CSP.
import "pixi.js/unsafe-eval";
import { RegistryContext } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ArkiniWindowTitle } from "../shared/ArkiniAppMetadata";
import { createArkpackCatalogFx } from "~/arkpack/renderer/createArkpackCatalogFx";
import { createRendererLifecycleFx } from "~/renderer/lifecycle/createRendererLifecycleFx";
import { ArkpackCatalogOwnerAtom } from "~/arkpack/renderer/ArkpackCatalogOwnerAtom";
import { RendererLifecycleOwnerAtom } from "~/renderer/lifecycle/RendererLifecycleOwnerAtom";
import { RendererAtomRegistry } from "~/renderer/RendererAtomRegistry";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import { refreshEditorServiceStatusFx } from "~/project-authoring/welcome/refreshEditorServiceStatusFx";
import { installEditorMcpVersionCheckoutFx } from "~/authoring-mcp/installEditorMcpVersionCheckoutFx";
import { installRendererControlledCloseFx } from "~/ui/root/installRendererControlledCloseFx";
import { installRendererNativeDragGuardFx } from "~/renderer/installRendererNativeDragGuardFx";
import { installWindowModeSyncFx } from "~/renderer/window/installWindowModeSyncFx";
import { createArkiniRouterFx } from "~/createArkiniRouterFx";
import { AppearanceDataset } from "~/ui/appearance/AppearanceDataset";
import { LauncherHeroAsset } from "~/ui/launcher/LauncherHeroAsset";
import { LauncherStartupConfigAtom } from "~/ui/launcher/LauncherStartupConfigAtom";
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
RendererRuntime.runSync(Atom.set(ArkpackCatalogOwnerAtom, catalog));
void RendererRuntime.runPromise(refreshEditorServiceStatusFx);
RendererRuntime.runSync(
	installRendererNativeDragGuardFx({
		root: rootElement,
	}),
);
const lifecycle = RendererRuntime.runSync(createRendererLifecycleFx(window.arkini.lifecycle));
RendererRuntime.runSync(Atom.set(RendererLifecycleOwnerAtom, lifecycle));
RendererRuntime.runSync(installWindowModeSyncFx());
RendererRuntime.runSync(
	Atom.set(LauncherStartupConfigAtom, {
		heroUrl: LauncherHeroAsset.url,
	}),
);
const router = RendererRuntime.runSync(
	createArkiniRouterFx({
		rendererRuntime: RendererRuntime,
	}),
);
RendererRuntime.runSync(
	installEditorMcpVersionCheckoutFx({
		editorMcp: window.arkini.editorMcp,
		rendererRuntime: RendererRuntime,
		router,
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
