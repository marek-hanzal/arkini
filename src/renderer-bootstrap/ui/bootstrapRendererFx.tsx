import { RegistryContext } from "@effect/atom-react";
import { RouterProvider } from "@tanstack/react-router";
import { Cause, Effect, Exit } from "effect";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ArkiniWindowTitle } from "~shared/ArkiniAppMetadata";
import { bootstrapArkpackCatalogFx } from "~/arkpack-catalog/fx/bootstrapArkpackCatalogFx";
import { bootstrapEditorMcpVersionCheckoutFx } from "~/authoring-mcp/fx/bootstrapEditorMcpVersionCheckoutFx";
import { bootstrapRendererLifecycleFx } from "~/application-runtime/fx/bootstrapRendererLifecycleFx";
import { bootstrapRendererControlledCloseFx } from "~/application-runtime/fx/bootstrapRendererControlledCloseFx";
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
import { bootstrapWindowModeSyncFx } from "~/window-mode/fx/bootstrapWindowModeSyncFx";

const readRendererRootFx = Effect.sync(() => {
	const rootElement = document.getElementById("root");
	if (rootElement === null) throw new Error("Arkini root element is missing.");
	return rootElement;
});

const forceCloseUnrenderableRendererFx = Effect.sync(() =>
	window.arkini.lifecycle.forceCloseFn(),
).pipe(
	Effect.catchCause((cause) =>
		Effect.sync(() => {
			console.error(
				"Arkini could not close after its fatal renderer surface failed.",
				Cause.squash(cause),
			);
		}),
	),
);

/** Owns the ordered renderer-process bootstrap from platform adapters to React. */
export const bootstrapRendererFx = Effect.fn("bootstrapRendererFx")(() =>
	Effect.gen(function* () {
		const rootElement = yield* readRendererRootFx;
		const root = yield* Effect.sync(() => createRoot(rootElement));

		yield* renderRendererFx({
			onCloseFn: () => window.arkini.lifecycle.forceCloseFn(),
			root,
			viewFx: Effect.gen(function* () {
				const translation = yield* bootstrapTranslationFx({
					readPreferredLanguagesFn: window.arkini.localization.readPreferredLanguagesFn,
				});
				document.title = ArkiniWindowTitle;
				document.documentElement.lang = translation.locale;

				yield* bootstrapArkpackCatalogFx();
				yield* refreshEditorServiceStatusFx.pipe(Effect.forkDetach);
				yield* installRendererNativeDragGuardFx({
					root: rootElement,
				});
				yield* bootstrapRendererLifecycleFx(window.arkini.lifecycle);
				yield* bootstrapWindowModeSyncFx();
				yield* bootstrapLauncherFx();

				const router = yield* createArkiniRouterFx({
					rendererRuntime: RendererRuntime,
				});
				yield* bootstrapEditorMcpVersionCheckoutFx({
					editorMcp: window.arkini.editorMcp,
					rendererRuntime: RendererRuntime,
					router,
				});
				yield* bootstrapRendererControlledCloseFx({
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
	}).pipe(
		Effect.onExit((exit) =>
			Exit.isFailure(exit) ? forceCloseUnrenderableRendererFx : Effect.void,
		),
	),
);
