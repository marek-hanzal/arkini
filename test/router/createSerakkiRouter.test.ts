// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSerakkiRouterFx } from "~/createSerakkiRouterFx";
import { createTestRendererRuntime } from "~test/support/createTestRendererRuntime";
import { resolveRouteViewTransitionTypesFx } from "~/application-shell/fx/resolveRouteViewTransitionTypesFx";

const originalStartViewTransition = document.startViewTransition;
const originalCss = window.CSS;
const runtimes: Array<ReturnType<typeof createTestRendererRuntime>["rendererRuntime"]> = [];

const createRouter = () => {
	const { rendererRuntime } = createTestRendererRuntime({
		createResourceFx: () => Effect.never,
	});
	runtimes.push(rendererRuntime);
	return Effect.runSync(
		createSerakkiRouterFx({
			rendererRuntime,
		}),
	);
};

const resolveTypes = (fromPathname: string | undefined, toPathname: string) =>
	Effect.runSync(
		resolveRouteViewTransitionTypesFx({
			fromLocation:
				fromPathname === undefined
					? undefined
					: {
							pathname: fromPathname,
						},
			toLocation: {
				pathname: toPathname,
			},
		}),
	);

afterEach(async () => {
	for (const runtime of runtimes.splice(0)) await runtime.dispose();
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

describe("createSerakkiRouterFx", () => {
	it("assigns one explicit native transition family to every visible route pair", () => {
		const pairs = [
			[
				"/",
				"/main-menu",
				[
					"serakki-route",
					"hero-to-hero",
					"startup-to-main-menu",
				],
			],
			[
				"/",
				"/action/load-game/built-in",
				[
					"serakki-route",
					"hero-to-hero",
					"startup-to-action",
				],
			],
			[
				"/",
				"/game/built-in/board",
				[
					"serakki-route",
					"hero-to-board",
					"startup-to-board",
				],
			],
			[
				"/main-menu",
				"/",
				[
					"serakki-route",
					"hero-to-hero",
					"main-menu-to-startup",
				],
			],
			[
				"/main-menu",
				"/settings",
				[
					"serakki-route",
					"hero-to-hero",
					"main-menu-to-settings",
				],
			],
			[
				"/main-menu",
				"/action/load-game/built-in",
				[
					"serakki-route",
					"hero-to-hero",
					"main-menu-to-action",
				],
			],
			[
				"/main-menu",
				"/game/built-in/board",
				[
					"serakki-route",
					"hero-to-board",
					"main-menu-to-board",
				],
			],
			[
				"/main-menu",
				"/serapacks",
				[
					"serakki-route",
					"hero-to-hero",
					"main-menu-to-serapacks",
				],
			],
			[
				"/serapacks",
				"/editor/serakki/editor",
				[
					"serakki-route",
					"hero-to-board",
					"serapacks-to-editor",
				],
			],
			[
				"/editor/serakki/editor",
				"/editor/serakki/project",
				[
					"serakki-route",
					"board-to-board",
					"editor-to-editor",
				],
			],
			[
				"/editor/serakki/project",
				"/main-menu",
				[
					"serakki-route",
					"board-to-hero",
					"editor-to-main-menu",
				],
			],
			[
				"/game/built-in/board",
				"/",
				[
					"serakki-route",
					"board-to-hero",
					"board-to-startup",
				],
			],
			[
				"/game/built-in/board",
				"/settings",
				[
					"serakki-route",
					"board-to-hero",
					"board-to-settings",
				],
			],
			[
				"/game/built-in/board",
				"/game/built-in/action/leave",
				[
					"serakki-route",
					"board-to-hero",
					"board-to-action",
				],
			],
			[
				"/game/built-in/board",
				"/game/built-in/action/exit",
				[
					"serakki-route",
					"board-to-hero",
					"board-to-action",
				],
			],
			[
				"/game/built-in/board",
				"/game/other/board",
				[
					"serakki-route",
					"board-to-board",
				],
			],
			[
				"/game/built-in/board",
				"/game/built-in/cheats",
				[
					"serakki-route",
					"board-to-board",
					"board-to-cheats",
				],
			],
			[
				"/game/built-in/cheats",
				"/game/built-in/board",
				[
					"serakki-route",
					"board-to-board",
					"cheats-to-board",
				],
			],
			[
				"/action/load-game/built-in",
				"/",
				[
					"serakki-route",
					"hero-to-hero",
					"action-to-startup",
				],
			],
			[
				"/game/built-in/action/leave",
				"/settings",
				[
					"serakki-route",
					"hero-to-hero",
					"action-to-settings",
				],
			],
			[
				"/action/load-game/built-in",
				"/game/built-in/board",
				[
					"serakki-route",
					"hero-to-board",
					"action-to-board",
				],
			],
			[
				"/game/built-in/action/reset",
				"/action/load-game/built-in",
				[
					"serakki-route",
					"hero-to-hero",
					"action-to-action",
				],
			],
			[
				"/game/built-in/action/leave",
				"/game/built-in/action/exit",
				[
					"serakki-route",
					"hero-to-hero",
					"action-to-action",
				],
			],
		] as const;

		expect(resolveTypes(undefined, "/main-menu")).toBe(false);
		expect(resolveTypes("/main-menu", "/main-menu")).toBe(false);
		expect(resolveTypes("/main-menu", "/editor")).toEqual([
			"serakki-route",
			"hero-to-hero",
			"main-menu-to-serapacks",
		]);
		for (const [from, to, types] of pairs) {
			expect(resolveTypes(from, to)).toEqual(types);
		}
		expect(resolveTypes("/main-menu", "/settings/common")).toEqual([
			"serakki-route",
			"hero-to-hero",
			"main-menu-to-settings",
		]);
		expect(resolveTypes("/settings/common", "/settings/game")).toEqual([
			"serakki-route",
			"hero-to-hero",
			"settings-to-settings",
		]);
		expect(resolveTypes("/settings/game", "/settings/sound")).toEqual([
			"serakki-route",
			"hero-to-hero",
			"settings-to-settings",
		]);
		expect(resolveTypes("/settings/sound", "/settings/dev")).toEqual([
			"serakki-route",
			"hero-to-hero",
			"settings-to-settings",
		]);
		expect(() => resolveTypes("/game/built-in/board", "/dev/shell")).toThrow(
			"Missing View Transition classification",
		);
	});

	it("skips native transitions between sections of the same artwork detail", () => {
		const sections = [
			"overview",
			"usage",
			"notes",
			"delete",
		] as const;
		for (const from of sections) {
			for (const to of sections) {
				if (from === to) continue;
				expect(
					resolveTypes(
						`/editor/serakki/artwork/producer-townhall-t3/detail/${from}`,
						`/editor/serakki/artwork/producer-townhall-t3/detail/${to}`,
					),
				).toBe(false);
			}
		}
		expect(
			resolveTypes(
				"/editor/serakki/artwork/producer-townhall-t3/detail/overview",
				"/editor/serakki/artwork/producer-academy/detail/overview",
			),
		).toEqual([
			"serakki-route",
			"board-to-board",
			"editor-to-editor",
		]);
	});

	it("uses the typed TanStack policy only when the renderer supports transition types", () => {
		Object.defineProperty(window, "CSS", {
			configurable: true,
			value: {
				supports: vi.fn(() => true),
			},
		});
		const router = createRouter();
		expect(router.options.defaultViewTransition).toEqual({
			types: expect.any(Function),
		});
	});

	it("disables route transitions rather than falling back to blanket animation", () => {
		Object.defineProperty(window, "CSS", {
			configurable: true,
			value: {
				supports: vi.fn(() => false),
			},
		});
		const router = createRouter();
		expect(router.options.defaultViewTransition).toBe(false);
	});

	it("falls back to a normal update when the browser API is unavailable", async () => {
		const router = createRouter();
		const update = vi.fn(async () => undefined);

		Reflect.deleteProperty(document, "startViewTransition");
		router.startViewTransition(update);
		await vi.waitFor(() => expect(update).toHaveBeenCalledOnce());
	});

	it.each([
		[
			"AbortError",
			"Transition was skipped",
		],
		[
			"InvalidStateError",
			"Transition was aborted because of invalid state",
		],
	])("handles the expected %s when a view transition is skipped", async (name, message) => {
		Object.defineProperty(window, "CSS", {
			configurable: true,
			value: {
				supports: vi.fn(() => true),
			},
		});
		const ready = Promise.reject(new DOMException(message, name));
		const catchReady = vi.spyOn(ready, "catch");
		Object.defineProperty(document, "startViewTransition", {
			configurable: true,
			value: vi.fn(() => ({
				finished: Promise.resolve(),
				ready,
				skipTransition: vi.fn(),
				types: new Set<string>(),
				updateCallbackDone: Promise.resolve(),
			})),
		});
		const router = createRouter();
		router.options.defaultViewTransition = true;

		router.startViewTransition(async () => undefined);
		await Promise.resolve();

		expect(catchReady).toHaveBeenCalledOnce();
	});
});
