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
	it("skips artwork section transitions only within the same resource", () => {
		expect(
			resolveTypes(
				"/editor/project/artwork/first/detail/overview",
				"/editor/project/artwork/first/detail/notes",
			),
		).toBe(false);
		expect(
			resolveTypes(
				"/editor/project/artwork/first/detail/overview",
				"/editor/project/artwork/second/detail/overview",
			),
		).not.toBe(false);
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
