import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ArkpackCatalogProvider } from "~/bridge/arkpack/ArkpackCatalogProvider";
import { createArkpackCatalogFx } from "~/bridge/arkpack/createArkpackCatalogFx";
import { findCachedGameEngine } from "~/bridge/game/findCachedGameEngine";
import { releaseGameEngineResourceFx } from "~/bridge/game/releaseGameEngineResourceFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { createArkiniRouter } from "~/router";
import { AppearanceProvider } from "~/ui/appearance/AppearanceProvider";
import { createLauncherStartupFx } from "~/ui/launcher/createLauncherStartupFx";
import { LauncherHeroAsset } from "~/ui/launcher/LauncherHeroAsset";
import { LauncherStartupHydrator } from "~/ui/launcher/LauncherStartupHydrator";
import { LauncherStartupProvider } from "~/ui/launcher/LauncherStartupProvider";
import "~/ui/styles.css";

interface HotData {
	gameEngineShutdown?: Promise<void>;
}

const hotData = import.meta.hot?.data as HotData | undefined;
const previousGameShutdown = hotData?.gameEngineShutdown ?? Promise.resolve();
const queryClient = new QueryClient();

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Arkini root element is missing.");
}

const catalog = RendererRuntime.runSync(createArkpackCatalogFx());
const launcherStartup = RendererRuntime.runSync(
	createLauncherStartupFx({
		catalog,
		heroUrl: LauncherHeroAsset.url,
	}),
);
void RendererRuntime.runPromise(launcherStartup.startFx).catch(() => {
	// The startup owner publishes the exact failure for the splash retry UI.
});
const router = createArkiniRouter({
	launcherStartup,
	previousGameShutdown,
	queryClient,
});

const removeBeforeClose = window.arkini.lifecycle.onBeforeClose(async () => {
	const cached = findCachedGameEngine(queryClient);
	if (cached === null) {
		await router.navigate({
			to: "/action/exit",
			replace: true,
		});
		return;
	}
	await router.navigate({
		to: "/game/$packageId/action/exit",
		params: {
			packageId: cached.packageId,
		},
		replace: true,
	});
});

import.meta.hot?.dispose((data: HotData) => {
	removeBeforeClose();
	const cached = findCachedGameEngine(queryClient);
	data.gameEngineShutdown =
		cached === null
			? Promise.resolve()
			: RendererRuntime.runPromise(
					releaseGameEngineResourceFx({
						queryClient,
						resource: cached.resource,
					}),
				);
});

createRoot(rootElement).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<ArkpackCatalogProvider catalog={catalog}>
				<LauncherStartupProvider startup={launcherStartup}>
					<AppearanceProvider>
						<LauncherStartupHydrator />
						<RouterProvider router={router} />
					</AppearanceProvider>
				</LauncherStartupProvider>
			</ArkpackCatalogProvider>
		</QueryClientProvider>
	</StrictMode>,
);
