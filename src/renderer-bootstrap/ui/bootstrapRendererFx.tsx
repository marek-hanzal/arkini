import { RegistryContext } from "@effect/atom-react";
import { RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ArkiniWindowTitle } from "~shared/ArkiniAppMetadata";
import { bootstrapArkpackCatalogFx } from "~/arkpack-catalog/fx/bootstrapArkpackCatalogFx";
import { installEditorMcpVersionCheckoutFx } from "~/authoring-mcp/fx/installEditorMcpVersionCheckoutFx";
import { bootstrapRendererLifecycleFx } from "~/application-runtime/fx/bootstrapRendererLifecycleFx";
import { installRendererControlledCloseFx } from "~/application-runtime/fx/installRendererControlledCloseFx";
import { installRendererNativeDragGuardFx } from "~/application-runtime/fx/installRendererNativeDragGuardFx";
import { RendererAtomRegistry } from "~/application-runtime/atom/RendererAtomRegistry";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { AppearanceDataset } from "~/application-settings/ui/AppearanceDataset";
import { renderRendererFx } from "~/application-shell/ui/renderRendererFx";
import { createArkiniRouterFx } from "~/createArkiniRouterFx";
import { bootstrapLauncherFx } from "~/launcher/fx/bootstrapLauncherFx";
import { LauncherStartupHydrator } from "~/launcher/ui/LauncherStartupHydrator";
import { refreshEditorServiceStatusFx } from "~/project-authoring/fx/refreshEditorServiceStatusFx";
import { bootstrapTranslationFx } from "~/translation/fx/bootstrapTranslationFx";
import { TranslationContext } from "~/translation/ui/TranslationContext";
import { installWindowModeSyncFx } from "~/window-mode/fx/installWindowModeSyncFx";

const readRendererRootFx = Effect.sync(() => {
	const rootElement = document.getElementById("root");
	if (rootElement === null) throw new Error("Arkini root element is missing.");
	return rootElement;
});

/** Owns the ordered renderer-process bootstrap from platform adapters to React. */
export const bootstrapRendererFx = Effect.fn("bootstrapRendererFx")(function* () {
	const rootElement = yield* readRendererRootFx;
	const root = yield* Effect.sync(() => createRoot(rootElement));

	yield* renderRendererFx({
		onCloseFn: () => window.arkini.lifecycle.forceCloseFn(),
		root,
		viewFx: Effect.gen(function* () {
			const translation = yield* bootstrapTranslationFx({
				localization: window.arkini.localization,
			});
			document.title = ArkiniWindowTitle;
			document.documentElement.lang = translation.locale;

			yield* bootstrapArkpackCatalogFx();
			yield* refreshEditorServiceStatusFx.pipe(Effect.forkDetach);
			yield* installRendererNativeDragGuardFx({
				root: rootElement,
			});
			yield* bootstrapRendererLifecycleFx(window.arkini.lifecycle);
			yield* installWindowModeSyncFx();
			yield* bootstrapLauncherFx();

			const router = yield* createArkiniRouterFx({
				rendererRuntime: RendererRuntime,
			});
			yield* installEditorMcpVersionCheckoutFx({
				editorMcp: window.arkini.editorMcp,
				rendererRuntime: RendererRuntime,
				router,
			});
			yield* installRendererControlledCloseFx({
				lifecycle: window.arkini.lifecycle,
				rendererRuntime: RendererRuntime,
				router,
			});

			return (
				<StrictMode>
					<TranslationContext.Provider value={translation.translator}>
						<RegistryContext.Provider value={RendererAtomRegistry}>
							<AppearanceDataset />
							<LauncherStartupHydrator />
							<RouterProvider router={router} />
						</RegistryContext.Provider>
					</TranslationContext.Provider>
				</StrictMode>
			);
		}),
	});
});
