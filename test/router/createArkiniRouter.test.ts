// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createArkiniRouterFx } from "~/createArkiniRouterFx";
import { createTestRendererRuntime } from "~test/support/createTestRendererRuntime";
import { resolveRouteViewTransitionTypesFx } from "~/ui/navigation/resolveRouteViewTransitionTypesFx";

const originalStartViewTransition = document.startViewTransition;
const originalCss = window.CSS;
const runtimes: Array<ReturnType<typeof createTestRendererRuntime>["rendererRuntime"]> = [];

const createRouter = () => {
	const { rendererRuntime } = createTestRendererRuntime({
		createResourceFx: () => Effect.never,
	});
	runtimes.push(rendererRuntime);
	return Effect.runSync(
		createArkiniRouterFx({
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

describe("createArkiniRouterFx", () => {
	it("assigns one explicit native transition family to every visible route pair", () => {
		const pairs = [
			[
				"/",
				"/main-menu",
				[
					"arkini-route",
					"hero-to-hero",
					"startup-to-main-menu",
				],
			],
			[
				"/",
				"/action/load-game/built-in",
				[
					"arkini-route",
					"hero-to-hero",
					"startup-to-action",
				],
			],
			[
				"/",
				"/game/built-in/board",
				[
					"arkini-route",
					"hero-to-board",
					"startup-to-board",
				],
			],
			[
				"/main-menu",
				"/",
				[
					"arkini-route",
					"hero-to-hero",
					"main-menu-to-startup",
				],
			],
			[
				"/main-menu",
				"/settings",
				[
					"arkini-route",
					"hero-to-hero",
					"main-menu-to-settings",
				],
			],
			[
				"/main-menu",
				"/action/load-game/built-in",
				[
					"arkini-route",
					"hero-to-hero",
					"main-menu-to-action",
				],
			],
			[
				"/main-menu",
				"/game/built-in/board",
				[
					"arkini-route",
					"hero-to-board",
					"main-menu-to-board",
				],
			],
			[
				"/main-menu",
				"/editor/welcome",
				[
					"arkini-route",
					"hero-to-hero",
					"main-menu-to-editor-welcome",
				],
			],
			[
				"/editor/welcome",
				"/editor/arkini/editor",
				[
					"arkini-route",
					"hero-to-board",
					"editor-welcome-to-editor",
				],
			],
			[
				"/editor/arkini/editor",
				"/editor/arkini/project",
				[
					"arkini-route",
					"board-to-board",
					"editor-to-editor",
				],
			],
			[
				"/editor/arkini/board",
				"/editor/arkini/board/inventory",
				[
					"arkini-route",
					"board-to-board",
					"editor-to-editor",
					"editor-board-leaf",
				],
			],
			[
				"/editor/arkini/board/inventory",
				"/editor/arkini/board",
				[
					"arkini-route",
					"board-to-board",
					"editor-to-editor",
					"editor-board-leaf",
				],
			],
			[
				"/editor/arkini/project",
				"/main-menu",
				[
					"arkini-route",
					"board-to-hero",
					"editor-to-main-menu",
				],
			],
			[
				"/game/built-in/board",
				"/",
				[
					"arkini-route",
					"board-to-hero",
					"board-to-startup",
				],
			],
			[
				"/game/built-in/board",
				"/settings",
				[
					"arkini-route",
					"board-to-hero",
					"board-to-settings",
				],
			],
			[
				"/game/built-in/board",
				"/game/built-in/action/leave",
				[
					"arkini-route",
					"board-to-hero",
					"board-to-action",
				],
			],
			[
				"/game/built-in/board",
				"/game/built-in/action/exit",
				[
					"arkini-route",
					"board-to-hero",
					"board-to-action",
				],
			],
			[
				"/game/built-in/board",
				"/game/other/board",
				[
					"arkini-route",
					"board-to-board",
				],
			],
			[
				"/game/built-in/board",
				"/game/built-in/inventory",
				[
					"arkini-route",
					"board-to-board",
					"board-to-inventory",
				],
			],
			[
				"/game/built-in/inventory",
				"/game/built-in/board",
				[
					"arkini-route",
					"board-to-board",
					"inventory-to-board",
				],
			],
			[
				"/game/built-in/board",
				"/game/built-in/cheats",
				[
					"arkini-route",
					"board-to-board",
					"board-to-cheats",
				],
			],
			[
				"/game/built-in/cheats",
				"/game/built-in/board",
				[
					"arkini-route",
					"board-to-board",
					"cheats-to-board",
				],
			],
			[
				"/action/load-game/built-in",
				"/",
				[
					"arkini-route",
					"hero-to-hero",
					"action-to-startup",
				],
			],
			[
				"/game/built-in/action/leave",
				"/settings",
				[
					"arkini-route",
					"hero-to-hero",
					"action-to-settings",
				],
			],
			[
				"/action/load-game/built-in",
				"/game/built-in/board",
				[
					"arkini-route",
					"hero-to-board",
					"action-to-board",
				],
			],
			[
				"/game/built-in/action/reset",
				"/action/load-game/built-in",
				[
					"arkini-route",
					"hero-to-hero",
					"action-to-action",
				],
			],
			[
				"/game/built-in/action/leave",
				"/game/built-in/action/exit",
				[
					"arkini-route",
					"hero-to-hero",
					"action-to-action",
				],
			],
		] as const;

		expect(resolveTypes(undefined, "/main-menu")).toBe(false);
		expect(resolveTypes("/main-menu", "/main-menu")).toBe(false);
		expect(resolveTypes("/main-menu", "/editor")).toEqual([
			"arkini-route",
			"hero-to-hero",
			"main-menu-to-editor-welcome",
		]);
		expect(resolveTypes("/main-menu", "/editor/welcome/")).toEqual([
			"arkini-route",
			"hero-to-hero",
			"main-menu-to-editor-welcome",
		]);
		for (const [from, to, types] of pairs) {
			expect(resolveTypes(from, to)).toEqual(types);
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
