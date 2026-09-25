import { RegistryContext } from "@effect/atom-react";
import { RouterProvider } from "@tanstack/react-router";
import { Cause, Effect, Exit } from "effect";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { SerakkiWindowTitle } from "~shared/SerakkiAppMetadata";
import { bootstrapSerapackCatalogFx } from "~/serapack-catalog/fx/bootstrapSerapackCatalogFx";
import { bootstrapRendererLifecycleFx } from "~/application-runtime/fx/bootstrapRendererLifecycleFx";
import { bootstrapRendererControlledCloseFx } from "~/application-runtime/fx/bootstrapRendererControlledCloseFx";
import { installRendererNativeDragGuardFx } from "~/application-runtime/fx/installRendererNativeDragGuardFx";
import { RendererAtomRegistry } from "~/application-runtime/atom/RendererAtomRegistry";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { AppearanceDataset } from "~/application-settings/ui/AppearanceDataset";
import { GraphicsUnavailablePage } from "~/application-shell/ui/GraphicsUnavailablePage";
import { renderRendererFx } from "~/application-shell/ui/renderRendererFx";
import { createSerakkiRouterFx } from "~/createSerakkiRouterFx";
import { bootstrapLauncherFx } from "~/launcher/fx/bootstrapLauncherFx";
import { LauncherStartupHydrator } from "~/launcher/ui/LauncherStartupHydrator";
import { refreshEditorServiceStatusFx } from "~/project-authoring/fx/refreshEditorServiceStatusFx";
import { bootstrapTranslationFx } from "~/translation/fx/bootstrapTranslationFx";
import { TranslationContext } from "~/translation/ui/TranslationContext";
import { bootstrapWindowModeSyncFx } from "~/window-mode/fx/bootstrapWindowModeSyncFx";
import { readGraphicsAvailabilityFx } from "~/tile-rendering/fx/readGraphicsAvailabilityFx";

const readRendererRootFx = Effect.sync(() => {
	const rootElement = document.getElementById("root");
	if (rootElement === null) throw new Error("Serakki root element is missing.");
	return rootElement;
});

const forceCloseUnrenderableRendererFx = Effect.sync(() =>
	window.serakki.lifecycle.forceCloseFn(),
).pipe(
	Effect.catchCause((cause) =>
		Effect.sync(() => {
			console.error(
				"Serakki could not close after its fatal renderer surface failed.",
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
			onCloseFn: () => window.serakki.lifecycle.forceCloseFn(),
			root,
			viewFx: Effect.gen(function* () {
				const translation = yield* bootstrapTranslationFx({
					readPreferredLanguagesFn: window.serakki.localization.readPreferredLanguagesFn,
				});
				document.title = SerakkiWindowTitle;
				document.documentElement.lang = translation.locale;
				if (!(yield* readGraphicsAvailabilityFx()))
					return (
						<GraphicsUnavailablePage
							onCloseFn={() => window.serakki.lifecycle.forceCloseFn()}
						/>
					);

				yield* bootstrapSerapackCatalogFx();
				yield* refreshEditorServiceStatusFx.pipe(Effect.forkDetach);
				yield* installRendererNativeDragGuardFx({
					root: rootElement,
				});
				yield* bootstrapRendererLifecycleFx(window.serakki.lifecycle);
				yield* bootstrapWindowModeSyncFx();
				yield* bootstrapLauncherFx();

				const router = yield* createSerakkiRouterFx({
					rendererRuntime: RendererRuntime,
				});
				yield* bootstrapRendererControlledCloseFx({
					lifecycle: window.serakki.lifecycle,
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
