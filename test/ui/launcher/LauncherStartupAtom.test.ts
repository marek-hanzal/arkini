// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import { Cause, Effect, SubscriptionRef } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArkpackCatalog } from "~/arkpack/renderer/ArkpackCatalog";
import { ArkpackCatalogOwnerAtom } from "~/arkpack/renderer/ArkpackCatalogOwnerAtom";
import { AppearanceAtom } from "~/ui/appearance/AppearanceAtom";
import { CheatAvailabilityAtom } from "~/ui/cheat-availability/CheatAvailabilityAtom";
import { WindowModeAtom } from "~/renderer/window/WindowModeAtom";
import { WindowModeReadyAtom } from "~/renderer/window/WindowModeReadyAtom";
import { LauncherAppearanceReadyAtom } from "~/ui/launcher/LauncherAppearanceReadyAtom";
import { LauncherCheatAvailabilityReadyAtom } from "~/ui/launcher/LauncherCheatAvailabilityReadyAtom";
import { LauncherSplashCompletedAtom } from "~/ui/launcher/LauncherSplashCompletedAtom";
import { LauncherStartupAtom } from "~/ui/launcher/LauncherStartupAtom";
import { LauncherStartupConfigAtom } from "~/ui/launcher/LauncherStartupConfigAtom";
import { completeLauncherSplashAtom } from "~/ui/launcher/completeLauncherSplashAtom";
import { retryLauncherStartupAtom } from "~/ui/launcher/retryLauncherStartupAtom";

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

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("LauncherStartupAtom", () => {
	it("runs one initial bootstrap and records idempotent splash completion", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(ArkpackCatalogOwnerAtom, catalog);
		const bootstrap = vi.fn();
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "hero.png",
			bootstrapFx: Effect.sync(() => {
				bootstrap();
				return {
					appearance: {
						theme: "light" as const,
						accent: "blue" as const,
					},
					defaultPackageId: "built-in",
					cheatsAvailable: true,
					windowMode: "bordered" as const,
				};
			}),
		});

		const releaseFirst = registry.mount(LauncherStartupAtom);
		const releaseSecond = registry.mount(LauncherStartupAtom);
		await vi.waitFor(() => {
			const startup = registry.get(LauncherStartupAtom);
			expect(AsyncResult.isSuccess(startup) && !startup.waiting).toBe(true);
		});

		expect(bootstrap).toHaveBeenCalledOnce();
		expect(registry.get(AppearanceAtom)).toEqual({
			theme: "light",
			accent: "blue",
		});
		expect(registry.get(CheatAvailabilityAtom)).toBe(true);
		expect(registry.get(LauncherAppearanceReadyAtom)).toBe(true);
		expect(registry.get(LauncherCheatAvailabilityReadyAtom)).toBe(true);
		expect(registry.get(WindowModeReadyAtom)).toBe(true);
		expect(registry.get(WindowModeAtom)).toBe("bordered");
		expect(registry.get(LauncherSplashCompletedAtom)).toBe(false);

		registry.set(completeLauncherSplashAtom, undefined);
		await vi.waitFor(() => expect(registry.get(LauncherSplashCompletedAtom)).toBe(true));
		registry.set(completeLauncherSplashAtom, undefined);
		expect(registry.get(LauncherSplashCompletedAtom)).toBe(true);

		releaseFirst();
		releaseSecond();
	});

	it("keeps a failed bootstrap retryable through the same AsyncResult Atom", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(ArkpackCatalogOwnerAtom, catalog);
		let attempt = 0;
		const failure = new Error("catalog unavailable");
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "hero.png",
			bootstrapFx: Effect.suspend(() => {
				attempt += 1;
				return attempt === 1
					? Effect.fail(failure)
					: Effect.succeed({
							appearance: {
								theme: "dark" as const,
								accent: "rose" as const,
							},
							defaultPackageId: "built-in",
							cheatsAvailable: false,
							windowMode: "bordered" as const,
						});
			}),
		});

		registry.mount(LauncherStartupAtom);
		await vi.waitFor(() => {
			const startup = registry.get(LauncherStartupAtom);
			expect(AsyncResult.isFailure(startup) && !startup.waiting).toBe(true);
			if (AsyncResult.isFailure(startup)) {
				expect(Cause.squash(startup.cause)).toBe(failure);
			}
		});

		registry.set(retryLauncherStartupAtom, undefined);
		await vi.waitFor(() => {
			const startup = registry.get(LauncherStartupAtom);
			expect(AsyncResult.isSuccess(startup) && !startup.waiting).toBe(true);
		});
		expect(attempt).toBe(2);
	});

	it("joins duplicate retry requests without restarting the active attempt", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(ArkpackCatalogOwnerAtom, catalog);
		let attempt = 0;
		let resolveRetry!: () => void;
		const retryGate = new Promise<void>((resolve) => {
			resolveRetry = resolve;
		});
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "hero.png",
			bootstrapFx: Effect.suspend(() => {
				attempt += 1;
				if (attempt === 1) return Effect.fail(new Error("first failed"));
				return Effect.promise(() => retryGate).pipe(
					Effect.as({
						appearance: {
							theme: "dark" as const,
							accent: "rose" as const,
						},
						defaultPackageId: "built-in",
						cheatsAvailable: false,
						windowMode: "bordered" as const,
					}),
				);
			}),
		});

		registry.mount(LauncherStartupAtom);
		await vi.waitFor(() =>
			expect(AsyncResult.isFailure(registry.get(LauncherStartupAtom))).toBe(true),
		);
		registry.set(retryLauncherStartupAtom, undefined);
		registry.set(retryLauncherStartupAtom, undefined);
		await vi.waitFor(() => {
			expect(registry.get(LauncherStartupAtom).waiting).toBe(true);
			expect(attempt).toBe(2);
		});

		resolveRetry();
		await vi.waitFor(() => {
			const startup = registry.get(LauncherStartupAtom);
			expect(AsyncResult.isSuccess(startup) && !startup.waiting).toBe(true);
		});
		expect(attempt).toBe(2);
	});

	it("never reapplies consumed persisted preferences on retry", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(ArkpackCatalogOwnerAtom, catalog);
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "hero.png",
			bootstrapFx: Effect.succeed({
				appearance: {
					theme: "light" as const,
					accent: "blue" as const,
				},
				defaultPackageId: "built-in",
				cheatsAvailable: true,
				windowMode: "bordered" as const,
			}),
		});

		registry.mount(LauncherStartupAtom);
		await vi.waitFor(() =>
			expect(AsyncResult.isSuccess(registry.get(LauncherStartupAtom))).toBe(true),
		);
		registry.set(AppearanceAtom, {
			theme: "dark",
			accent: "rose",
		});
		registry.set(CheatAvailabilityAtom, false);
		registry.set(WindowModeAtom, "fullscreen");
		registry.set(retryLauncherStartupAtom, undefined);
		await vi.waitFor(() => {
			const startup = registry.get(LauncherStartupAtom);
			expect(AsyncResult.isSuccess(startup) && !startup.waiting).toBe(true);
		});

		expect(registry.get(AppearanceAtom)).toEqual({
			theme: "dark",
			accent: "rose",
		});
		expect(registry.get(CheatAvailabilityAtom)).toBe(false);
		expect(registry.get(WindowModeAtom)).toBe("fullscreen");
	});

	it("interrupts pending bootstrap work when the registry is disposed", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(ArkpackCatalogOwnerAtom, catalog);
		const started = vi.fn();
		const interrupted = vi.fn();
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "hero.png",
			bootstrapFx: Effect.sync(started).pipe(
				Effect.andThen(Effect.never),
				Effect.onInterrupt(() => Effect.sync(interrupted)),
			),
		});

		registry.mount(LauncherStartupAtom);
		await vi.waitFor(() => expect(started).toHaveBeenCalledOnce());
		registry.dispose();
		await vi.waitFor(() => expect(interrupted).toHaveBeenCalledOnce());
	});
});
