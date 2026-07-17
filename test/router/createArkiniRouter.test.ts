// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createArkiniRouter } from "~/router";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";

const createStartup = (): LauncherStartup => {
	const state: LauncherStartup.State = {
		type: "ready",
		appearance: {
			theme: "dark",
			accent: "rose",
		},
		builtInPackageId: "built-in",
		splashCompleted: true,
	};

	return {
		startedAtMs: 0,
		getSnapshot: () => state,
		startFx: Effect.void,
		retryFx: Effect.void,
		completeSplashFx: Effect.void,
		subscribe: () => () => undefined,
	};
};

const originalStartViewTransition = document.startViewTransition;

afterEach(() => {
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
	it("uses native view transitions when available", async () => {
		const router = createArkiniRouter({
			launcherStartup: createStartup(),
		});
		const update = vi.fn(async () => undefined);
		const startViewTransition = vi.fn((callback: () => Promise<void>) => {
			void callback();
			return undefined as unknown as ViewTransition;
		});

		Object.defineProperty(document, "startViewTransition", {
			configurable: true,
			value: startViewTransition,
		});

		router.startViewTransition(update);
		await vi.waitFor(() => expect(update).toHaveBeenCalledOnce());

		expect(router.options.defaultViewTransition).toBe(true);
		expect(startViewTransition).toHaveBeenCalledOnce();
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
