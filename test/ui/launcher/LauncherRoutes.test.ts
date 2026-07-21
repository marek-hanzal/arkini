import { QueryClient } from "@tanstack/react-query";
// @vitest-environment jsdom

import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { routeTree } from "~/_route";
import { createCheatAvailability } from "~/bridge/cheat/createCheatAvailability";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";

const createStartup = (splashCompleted: boolean): LauncherStartup => {
	const state: LauncherStartup.State = {
		type: "ready",
		appearance: {
			theme: "dark",
			accent: "rose",
		},
		builtInPackageId: "built-in",
		cheatsAvailable: false,
		heroReady: true,
		splashCompleted,
	};
	return {
		getSnapshot: () => state,
		startFx: Effect.void,
		retryFx: Effect.void,
		completeSplashFx: Effect.void,
		subscribe: () => () => undefined,
	};
};

const loadRoute = async (path: string, splashCompleted = false) => {
	const router = createRouter({
		routeTree,
		isServer: false,
		context: {
			cheatAvailability: createCheatAvailability(),
			launcherStartup: createStartup(splashCompleted),
			previousGameShutdown: Promise.resolve(),
			queryClient: new QueryClient(),
		},
		history: createMemoryHistory({
			initialEntries: [
				path,
			],
		}),
	});
	await router.load();
	return router;
};

describe("launcher routes", () => {
	it("redirects later renderer-session visits from root to the semantic main menu", async () => {
		const router = await loadRoute("/main-menu", true);
		await router.navigate({
			to: "/",
		});
		await router.load();
		expect(router.state.location.pathname).toBe("/main-menu");
	});

	it.each([
		"/arkpacks",
		"/settings",
		"/about",
	])("keeps %s as a standalone top-level destination", async (path) => {
		const router = await loadRoute(path);
		expect(router.state.location.pathname).toBe(path);
	});
});
