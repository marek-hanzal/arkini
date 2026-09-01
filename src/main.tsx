// Installs Pixi's static shader/uniform synchronizers before the renderer graph
// is evaluated so Electron can keep its strict no-unsafe-eval CSP.
import "pixi.js/unsafe-eval";
import { RegistryContext } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { Effect } from "effect";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ArkiniWindowTitle } from "~shared/ArkiniAppMetadata";
import { createArkpackCatalogFx } from "~/arkpack-catalog/fx/createArkpackCatalogFx";
import { createRendererLifecycleFx } from "~/application-runtime/fx/createRendererLifecycleFx";
import { ArkpackCatalogOwnerAtom } from "~/arkpack-catalog/atom/ArkpackCatalogOwnerAtom";
import { RendererLifecycleOwnerAtom } from "~/application-runtime/atom/RendererLifecycleOwnerAtom";
import { RendererAtomRegistry } from "~/application-runtime/atom/RendererAtomRegistry";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { refreshEditorServiceStatusFx } from "~/project-authoring/fx/refreshEditorServiceStatusFx";
import { installEditorMcpVersionCheckoutFx } from "~/authoring-mcp/fx/installEditorMcpVersionCheckoutFx";
import { installRendererControlledCloseFx } from "~/application-runtime/fx/installRendererControlledCloseFx";
import { installRendererNativeDragGuardFx } from "~/application-runtime/fx/installRendererNativeDragGuardFx";
import { installWindowModeSyncFx } from "~/window-mode/fx/installWindowModeSyncFx";
import { createArkiniRouterFx } from "~/createArkiniRouterFx";
import { renderRendererFx } from "~/application-shell/ui/renderRendererFx";
import { AppearanceDataset } from "~/application-settings/ui/AppearanceDataset";
import {
	LauncherHeroAsset,
	LauncherStartupConfigAtom,
} from "~/launcher/atom/LauncherStartupConfigAtom";
import { LauncherStartupHydrator } from "~/launcher/ui/LauncherStartupHydrator";
import { loadTranslatorFx } from "~/translation/fx/loadTranslatorFx";
import { setTranslatorFx, translator } from "~/translation/service/translator";
import { TranslationContext } from "~/translation/ui/TranslationContext";
import "~/launcher/ui/launcher.css";
import "~/main.css";

/**
 * Renderer composition root. Every owner built here has process lifetime and
 * must exist before React consumers mount; StrictMode remounts must never
 * duplicate the registry, runtime-backed authorities or native close listeners.
 */
const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Arkini root element is missing.");
}
const root = createRoot(rootElement);

void RendererRuntime.runPromise(
	renderRendererFx({
		onCloseFn: () => window.arkini.lifecycle.forceCloseFn(),
		root,
		viewFx: Effect.gen(function* () {
			const preferredLocales = yield* Effect.promise(() =>
				window.arkini.localization.readPreferredLanguagesFn(),
			);
			const translation = yield* loadTranslatorFx({
				preferredLocales,
			});
			yield* setTranslatorFx(translation.translator);

			document.title = ArkiniWindowTitle;
			document.documentElement.lang = translation.locale;

			const catalog = yield* createArkpackCatalogFx();
			yield* Atom.set(ArkpackCatalogOwnerAtom, catalog);
			yield* refreshEditorServiceStatusFx.pipe(Effect.forkDetach);
			yield* installRendererNativeDragGuardFx({
				root: rootElement,
			});
			const lifecycle = yield* createRendererLifecycleFx(window.arkini.lifecycle);
			yield* Atom.set(RendererLifecycleOwnerAtom, lifecycle);
			yield* installWindowModeSyncFx();
			yield* Atom.set(LauncherStartupConfigAtom, {
				heroUrl: LauncherHeroAsset.url,
			});
			const router = yield* createArkiniRouterFx({
				rendererRuntime: RendererRuntime,
			});
			yield* installEditorMcpVersionCheckoutFx({
				editorMcp: window.arkini.editorMcp,
				rendererRuntime: RendererRuntime,
				router,
			});
			// Install the native handshake once at the process boundary, outside React ownership.
			yield* installRendererControlledCloseFx({
				lifecycle: window.arkini.lifecycle,
				rendererRuntime: RendererRuntime,
				router,
			});

			return (
				<StrictMode>
					<TranslationContext.Provider value={translator}>
						<RegistryContext.Provider value={RendererAtomRegistry}>
							<AppearanceDataset />
							<LauncherStartupHydrator />
							<RouterProvider router={router} />
						</RegistryContext.Provider>
					</TranslationContext.Provider>
				</StrictMode>
			);
		}),
	}),
).catch((cause) => {
	console.error("Arkini renderer fatal surface could not render.", cause);
});
