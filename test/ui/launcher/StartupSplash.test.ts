// @vitest-environment jsdom

import { Effect, SubscriptionRef } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { LauncherSplashCompletedAtom } from "~/ui/launcher/LauncherSplashCompletedAtom";
import { renderStartupSplashFx } from "~test/ui/launcher/support/renderStartupSplashFx";

const roots: Root[] = [];
const registries: AtomRegistry.AtomRegistry[] = [];
const catalog: ArkpackCatalog = {
	awaitIdleFx: Effect.void,
	state: Effect.runSync(
		SubscriptionRef.make<ArkpackCatalog.State>({
			type: "loading",
		}),
	),
	refreshFx: Effect.void,
	importFileFx: () => Effect.die("unused"),
	installFx: () => Effect.die("unused"),
	removeFx: () => Effect.die("unused"),
};
const readyResult = {
	appearance: {
		theme: "dark" as const,
		accent: "rose" as const,
	},
	defaultPackageId: "canonical-built-in",
	cheatsAvailable: false,
	windowMode: "bordered" as const,
};

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("StartupSplash", () => {
	it("anchors the black hold to actual window visibility", async () => {
		const harness = await Effect.runPromise(
			renderStartupSplashFx({
				bootstrapFx: Effect.succeed(readyResult),
				catalog,
			}),
		);
		roots.push(harness.root);
		registries.push(harness.registry);
		expect(harness.container.querySelector('[data-ui="StartupBlackHold"]')).not.toBeNull();

		await act(async () => vi.advanceTimersByTime(10_000));
		expect(harness.container.querySelector('[data-ui="StartupBlackHold"]')).not.toBeNull();

		await act(async () => harness.resolveVisible(performance.now()));
		await act(async () => vi.advanceTimersByTime(499));
		expect(harness.container.querySelector('[data-ui="StartupBlackHold"]')).not.toBeNull();
		await act(async () => vi.advanceTimersByTime(1));
		expect(harness.container.querySelector('[data-ui="StartupSplash"]')).not.toBeNull();
		expect(harness.container.textContent).toContain("Press Esc to continue");
	});

	it("uses Escape to complete the splash before navigating", async () => {
		const harness = await Effect.runPromise(
			renderStartupSplashFx({
				bootstrapFx: Effect.succeed(readyResult),
				catalog,
			}),
		);
		roots.push(harness.root);
		registries.push(harness.registry);
		await act(async () => harness.resolveVisible(performance.now()));
		await act(async () => vi.advanceTimersByTime(500));

		expect(harness.container.querySelector('[data-ui="StartupHeroHandoff"]')).toBeNull();
		expect(harness.container.textContent).not.toContain("Main menu route");
		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
					cancelable: true,
				}),
			);
		});

		await vi.waitFor(() =>
			expect(harness.registry.get(LauncherSplashCompletedAtom)).toBe(true),
		);
		await vi.waitFor(() => expect(harness.router.state.location.pathname).toBe("/main-menu"));
	});

	it("uses a splash click to continue without changing the Escape hint", async () => {
		const harness = await Effect.runPromise(
			renderStartupSplashFx({
				bootstrapFx: Effect.succeed(readyResult),
				catalog,
			}),
		);
		roots.push(harness.root);
		registries.push(harness.registry);
		await act(async () => harness.resolveVisible(performance.now()));
		await act(async () => vi.advanceTimersByTime(500));

		const splash = harness.container.querySelector('[data-ui="StartupSplash"]');
		if (!(splash instanceof HTMLElement)) throw new Error("Startup splash missing.");
		expect(harness.container.textContent).toContain("Press Esc to continue");
		await act(async () => splash.click());

		await vi.waitFor(() =>
			expect(harness.registry.get(LauncherSplashCompletedAtom)).toBe(true),
		);
		await vi.waitFor(() => expect(harness.router.state.location.pathname).toBe("/main-menu"));
	});

	it("completes automatically after the minimum visible duration", async () => {
		const harness = await Effect.runPromise(
			renderStartupSplashFx({
				bootstrapFx: Effect.succeed(readyResult),
				catalog,
			}),
		);
		roots.push(harness.root);
		registries.push(harness.registry);
		await act(async () => harness.resolveVisible(performance.now()));
		await act(async () => vi.advanceTimersByTime(5_000));

		await vi.waitFor(() =>
			expect(harness.registry.get(LauncherSplashCompletedAtom)).toBe(true),
		);
		await vi.waitFor(() => expect(harness.router.state.location.pathname).toBe("/main-menu"));
	});

	it("shows a rejected navigation and retries it without leaving the splash stuck", async () => {
		const harness = await Effect.runPromise(
			renderStartupSplashFx({
				bootstrapFx: Effect.succeed(readyResult),
				catalog,
			}),
		);
		roots.push(harness.root);
		registries.push(harness.registry);
		const navigationFailure = new Error("main menu route failed");
		vi.spyOn(harness.router, "navigate").mockRejectedValueOnce(navigationFailure);
		await act(async () => harness.resolveVisible(performance.now()));
		await act(async () => vi.advanceTimersByTime(5_000));

		await vi.waitFor(() =>
			expect(harness.container.textContent).toContain(navigationFailure.message),
		);
		expect(harness.router.state.location.pathname).toBe("/");
		expect(harness.registry.get(LauncherSplashCompletedAtom)).toBe(false);
		const retry = Array.from(harness.container.querySelectorAll("button")).find(
			(button) => button.textContent === "Retry",
		);
		if (!(retry instanceof HTMLButtonElement)) throw new Error("Retry button missing.");
		await act(async () => retry.click());

		await vi.waitFor(() => expect(harness.router.state.location.pathname).toBe("/main-menu"));
		expect(harness.registry.get(LauncherSplashCompletedAtom)).toBe(true);
	});

	it("keeps startup failures on the same page and retries through Atom.fn", async () => {
		let attempt = 0;
		const harness = await Effect.runPromise(
			renderStartupSplashFx({
				bootstrapFx: Effect.suspend(() => {
					attempt += 1;
					return attempt === 1
						? Effect.fail(new Error("catalog failed"))
						: Effect.succeed(readyResult);
				}),
				catalog,
			}),
		);
		roots.push(harness.root);
		registries.push(harness.registry);
		await act(async () => harness.resolveVisible(performance.now()));
		await act(async () => vi.advanceTimersByTime(500));

		await vi.waitFor(() => expect(harness.container.textContent).toContain("catalog failed"));
		const retry = Array.from(harness.container.querySelectorAll("button")).find(
			(button) => button.textContent === "Retry",
		);
		if (!(retry instanceof HTMLButtonElement)) throw new Error("Retry button missing.");
		await act(async () => retry.click());
		await vi.waitFor(() => expect(attempt).toBe(2));
	});
});
