// @vitest-environment jsdom

import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { routeTree } from "~/_route";
import { LauncherSplashCompletedAtom } from "~/launcher/atom/LauncherSplashCompletedAtom";
import { createTestRendererRuntime } from "~test/support/createTestRendererRuntime";

const runtimeHarnesses: Array<ReturnType<typeof createTestRendererRuntime>> = [];

const loadRoute = async (path: string, splashCompleted = false) => {
	const runtimeHarness = createTestRendererRuntime({
		createResourceFx: () => Effect.never,
	});
	runtimeHarnesses.push(runtimeHarness);
	runtimeHarness.atomRegistry.set(LauncherSplashCompletedAtom, splashCompleted);
	const router = createRouter({
		routeTree,
		isServer: false,
		context: {
			rendererRuntime: runtimeHarness.rendererRuntime,
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

afterEach(async () => {
	for (const runtimeHarness of runtimeHarnesses.splice(0)) {
		await runtimeHarness.rendererRuntime.dispose();
		runtimeHarness.atomRegistry.dispose();
	}
});

describe("launcher routes", () => {
	it("redirects later renderer-session visits from root to the semantic main menu", async () => {
		const router = await loadRoute("/main-menu", true);
		await router.navigate({
			to: "/",
		});
		await router.load();
		expect(router.state.location.pathname).toBe("/main-menu");
	});

	it("keeps launcher leaves as standalone top-level destinations", async () => {
		const router = await loadRoute("/settings");
		expect(router.state.location.pathname).toBe("/settings/common");
	});

	it("loads every routed Settings section directly", async () => {
		for (const pathname of [
			"/settings/common",
			"/settings/game",
			"/settings/dev",
		]) {
			const router = await loadRoute(pathname);
			expect(router.state.location.pathname).toBe(pathname);
		}
	});
});
