// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createArkiniRouter } from "~/router";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { resolveRouteViewTransitionTypes } from "~/ui/navigation/resolveRouteViewTransitionTypes";

const createStartup = (): LauncherStartup => {
	const state: LauncherStartup.State = {
		type: "ready",
		appearance: {
			theme: "dark",
			accent: "rose",
		},
		builtInPackageId: "built-in",
		heroReady: true,
		splashCompleted: true,
	};

	return {
		getSnapshot: () => state,
		startFx: Effect.void,
		retryFx: Effect.void,
		completeSplashFx: Effect.void,
		subscribe: () => () => undefined,
	};
};

const originalStartViewTransition = document.startViewTransition;
const originalCss = window.CSS;

const resolveTypes = (fromPathname: string | undefined, toPathname: string) =>
	resolveRouteViewTransitionTypes({
		fromLocation:
			fromPathname === undefined
				? undefined
				: {
						pathname: fromPathname,
					},
		toLocation: {
			pathname: toPathname,
		},
	});

afterEach(() => {
	vi.restoreAllMocks();
	if (originalCss === undefined) {
		Reflect.deleteProperty(window, "CSS");
	} else {
		Object.defineProperty(window, "CSS", {
			configurable: true,
			value: originalCss,
		});
	}
	if (originalStartViewTransition === undefined) {
		Reflect.deleteProperty(document, "startViewTransition");
		return;
	}

	Object.defineProperty(document, "startViewTransition", {
		configurable: true,
		value: originalStartViewTransition,
	});
});

describe("createArkiniRouter", () => {
	it("opts into native transitions only for deliberate route pairs", () => {
		expect(resolveTypes(undefined, "/main-menu")).toBe(false);
		expect(resolveTypes("/", "/main-menu")).toBe(false);
		expect(resolveTypes("/main-menu", "/settings")).toEqual([
			"main-page",
		]);
		expect(resolveTypes("/settings", "/main-menu")).toEqual([
			"main-page",
		]);
		expect(resolveTypes("/main-menu", "/game/built-in")).toEqual([
			"main-page-game",
		]);
		expect(resolveTypes("/game/built-in", "/settings")).toEqual([
			"main-page-game",
		]);
		expect(resolveTypes("/game/built-in", "/dev/shell")).toBe(false);
	});

	it("uses the typed TanStack policy only when the renderer supports transition types", () => {
		Object.defineProperty(window, "CSS", {
			configurable: true,
			value: {
				supports: vi.fn(() => true),
			},
		});
		const router = createArkiniRouter({
			launcherStartup: createStartup(),
		});
		expect(router.options.defaultViewTransition).toEqual({
			types: resolveRouteViewTransitionTypes,
		});
	});

	it("disables route transitions rather than falling back to blanket animation", () => {
		Object.defineProperty(window, "CSS", {
			configurable: true,
			value: {
				supports: vi.fn(() => false),
			},
		});
		const router = createArkiniRouter({
			launcherStartup: createStartup(),
		});
		expect(router.options.defaultViewTransition).toBe(false);
	});

	it("falls back to a normal update when the browser API is unavailable", async () => {
		const router = createArkiniRouter({
			launcherStartup: createStartup(),
		});
		const update = vi.fn(async () => undefined);

		Reflect.deleteProperty(document, "startViewTransition");
		router.startViewTransition(update);
		await vi.waitFor(() => expect(update).toHaveBeenCalledOnce());
	});
});
