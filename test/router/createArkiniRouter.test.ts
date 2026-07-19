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
		const pairs = [
			[
				"/",
				"/main-menu",
				"startup-to-launcher",
			],
			[
				"/",
				"/action/load-game/built-in",
				"startup-to-action",
			],
			[
				"/",
				"/game/built-in/board",
				"startup-to-board",
			],
			[
				"/main-menu",
				"/",
				"launcher-to-startup",
			],
			[
				"/main-menu",
				"/settings",
				"launcher-to-launcher",
			],
			[
				"/main-menu",
				"/action/load-game/built-in",
				"launcher-to-action",
			],
			[
				"/main-menu",
				"/game/built-in/board",
				"launcher-to-board",
			],
			[
				"/game/built-in/board",
				"/",
				"board-to-startup",
			],
			[
				"/game/built-in/board",
				"/settings",
				"board-to-launcher",
			],
			[
				"/game/built-in/board",
				"/game/built-in/action/leave",
				"board-to-action",
			],
			[
				"/game/built-in/board",
				"/game/other/board",
				"board-to-board",
			],
			[
				"/action/load-game/built-in",
				"/",
				"action-to-startup",
			],
			[
				"/game/built-in/action/leave",
				"/settings",
				"action-to-launcher",
			],
			[
				"/action/load-game/built-in",
				"/game/built-in/board",
				"action-to-board",
			],
			[
				"/game/built-in/action/reset",
				"/action/load-game/built-in",
				"action-to-action",
			],
		] as const;

		expect(resolveTypes(undefined, "/main-menu")).toBe(false);
		expect(resolveTypes("/main-menu", "/main-menu")).toBe(false);
		for (const [from, to, type] of pairs) {
			expect(resolveTypes(from, to)).toEqual([
				"arkini-route",
				type,
			]);
		}
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
