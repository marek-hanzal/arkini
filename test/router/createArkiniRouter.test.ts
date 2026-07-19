import { QueryClient } from "@tanstack/react-query";
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
	it("assigns one explicit native transition family to every visible route pair", () => {
		expect(resolveTypes(undefined, "/main-menu")).toBe(false);
		expect(resolveTypes("/", "/main-menu")).toEqual([
			"arkini-route",
			"startup-to-launcher",
		]);
		expect(resolveTypes("/main-menu", "/settings")).toEqual([
			"arkini-route",
			"launcher-to-launcher",
		]);
		expect(resolveTypes("/main-menu", "/arkpacks")).toEqual([
			"arkini-route",
			"launcher-to-launcher",
		]);
		expect(resolveTypes("/main-menu", "/action/load-game/built-in")).toEqual([
			"arkini-route",
			"launcher-to-action",
		]);
		expect(resolveTypes("/game/built-in/board", "/game/built-in/action/leave")).toEqual([
			"arkini-route",
			"board-to-action",
		]);
		expect(resolveTypes("/game/built-in/action/reset", "/action/load-game/built-in")).toEqual([
			"arkini-route",
			"action-to-action",
		]);
		expect(resolveTypes("/action/load-game/built-in", "/game/built-in/board")).toEqual([
			"arkini-route",
			"action-to-board",
		]);
		expect(resolveTypes("/game/built-in/action/leave", "/settings")).toEqual([
			"arkini-route",
			"action-to-launcher",
		]);
		expect(() => resolveTypes("/game/built-in/board", "/dev/shell")).toThrow(
			"Missing View Transition classification",
		);
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
			previousGameShutdown: Promise.resolve(),
			queryClient: new QueryClient(),
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
			previousGameShutdown: Promise.resolve(),
			queryClient: new QueryClient(),
		});
		expect(router.options.defaultViewTransition).toBe(false);
	});

	it("falls back to a normal update when the browser API is unavailable", async () => {
		const router = createArkiniRouter({
			launcherStartup: createStartup(),
			previousGameShutdown: Promise.resolve(),
			queryClient: new QueryClient(),
		});
		const update = vi.fn(async () => undefined);

		Reflect.deleteProperty(document, "startViewTransition");
		router.startViewTransition(update);
		await vi.waitFor(() => expect(update).toHaveBeenCalledOnce());
	});
});
