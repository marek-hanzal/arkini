import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { Cause, Effect, Exit, Option } from "effect";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ArkpackCatalogProvider } from "~/bridge/arkpack/ArkpackCatalogProvider";
import { createArkpackCatalogFx } from "~/bridge/arkpack/createArkpackCatalogFx";
import { createCheatAvailability } from "~/bridge/cheat/createCheatAvailability";
import { releaseGameEngineResourceFx } from "~/bridge/game/releaseGameEngineResourceFx";
import { waitForGameEngineResourceFx } from "~/bridge/game/waitForGameEngineResourceFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { installRendererControlledCloseFx } from "~/installRendererControlledCloseFx";
import { createArkiniRouter } from "~/router";
import { AppearanceProvider } from "~/ui/appearance/AppearanceProvider";
import { CheatAvailabilityProvider } from "~/ui/cheat-availability/CheatAvailabilityProvider";
import { createLauncherStartupFx } from "~/ui/launcher/createLauncherStartupFx";
import { LauncherHeroAsset } from "~/ui/launcher/LauncherHeroAsset";
import { LauncherStartupHydrator } from "~/ui/launcher/LauncherStartupHydrator";
import { LauncherStartupProvider } from "~/ui/launcher/LauncherStartupProvider";
import "~/ui/styles.css";

interface HotData {
	gameEngineShutdown?: Promise<void>;
	launcherStartupShutdown?: Promise<void>;
}

const hotData = import.meta.hot?.data as HotData | undefined;
const previousGameShutdown = hotData?.gameEngineShutdown ?? Promise.resolve();
const previousLauncherStartupShutdown = hotData?.launcherStartupShutdown ?? Promise.resolve();
const queryClient = new QueryClient();
const cheatAvailability = createCheatAvailability();

const runRendererEffect = async <Value, Error>(
	effect: Effect.Effect<Value, Error>,
): Promise<Value> => {
	const exit = await RendererRuntime.runPromiseExit(effect);
	if (Exit.isSuccess(exit)) return exit.value;
	const failure = Cause.failureOption(exit.cause);
	if (Option.isSome(failure)) throw failure.value;
	throw Cause.squash(exit.cause);
};

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Arkini root element is missing.");
}

const catalog = RendererRuntime.runSync(createArkpackCatalogFx());
const launcherStartup = RendererRuntime.runSync(
	createLauncherStartupFx({
		awaitPreviousShutdown: previousLauncherStartupShutdown,
		catalog,
		heroUrl: LauncherHeroAsset.url,
	}),
);
void RendererRuntime.runPromise(launcherStartup.startFx).catch(() => {
	// The startup owner publishes the exact failure for the splash retry UI.
});
const router = createArkiniRouter({
	cheatAvailability,
	launcherStartup,
	previousGameShutdown,
	queryClient,
});

const removeControlledClose = RendererRuntime.runSync(
	installRendererControlledCloseFx({
		lifecycle: window.arkini.lifecycle,
		queryClient,
		router,
	}),
);

import.meta.hot?.dispose((data: HotData) => {
	removeControlledClose();
	data.launcherStartupShutdown = RendererRuntime.runPromise(launcherStartup.disposeFx);
	data.gameEngineShutdown = runRendererEffect(
		waitForGameEngineResourceFx(queryClient).pipe(
			Effect.flatMap((resource) => {
				if (resource === null) return Effect.void;
				return Effect.try({
					try: () => resource.assertUsable(),
					catch: (cause) => cause,
				}).pipe(
					Effect.zipRight(
						releaseGameEngineResourceFx({
							allowAlreadyFinalized: true,
							queryClient,
							resource,
						}),
					),
					Effect.catchAllCause((cause) =>
						Effect.fail(
							resource.markCriticalFailure("hmr-handoff", Cause.squash(cause)),
						),
					),
				);
			}),
		),
	);
});

createRoot(rootElement).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<ArkpackCatalogProvider catalog={catalog}>
				<LauncherStartupProvider startup={launcherStartup}>
					<AppearanceProvider>
						<CheatAvailabilityProvider availability={cheatAvailability}>
							<LauncherStartupHydrator />
							<RouterProvider router={router} />
						</CheatAvailabilityProvider>
					</AppearanceProvider>
				</LauncherStartupProvider>
			</ArkpackCatalogProvider>
		</QueryClientProvider>
	</StrictMode>,
);
