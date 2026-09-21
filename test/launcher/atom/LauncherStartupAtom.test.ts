// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import { Cause, Effect, SubscriptionRef } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SerapackCatalog } from "~/serapack-catalog/service/SerapackCatalog";
import { SerapackCatalogOwnerAtom } from "~/serapack-catalog/atom/SerapackCatalogOwnerAtom";
import { AppearanceAtom } from "~/application-settings/atom/AppearanceAtom";
import { CheatAvailabilityAtom } from "~/application-settings/atom/CheatAvailabilityAtom";
import { WindowModeAtom } from "~/window-mode/atom/WindowModeAtom";
import { WindowModeReadyAtom } from "~/window-mode/atom/WindowModeReadyAtom";
import { LauncherAppearanceReadyAtom } from "~/launcher/atom/LauncherAppearanceReadyAtom";
import { LauncherCheatAvailabilityReadyAtom } from "~/launcher/atom/LauncherCheatAvailabilityReadyAtom";
import { LauncherSplashCompletedAtom } from "~/launcher/atom/LauncherSplashCompletedAtom";
import { LauncherStartupAtom } from "~/launcher/atom/LauncherStartupAtom";
import { LauncherStartupConfigAtom } from "~/launcher/atom/LauncherStartupConfigAtom";
import { completeLauncherSplashAtom } from "~/launcher/atom/completeLauncherSplashAtom";
import { retryLauncherStartupAtom } from "~/launcher/atom/retryLauncherStartupAtom";

import { defaultSoundSettings } from "~electron/contract/sound/SoundSettings";
import { SoundSettingsAtom } from "~/application-settings/atom/SoundSettingsAtom";
import { RendererLifecycleOwnerAtom } from "~/application-runtime/atom/RendererLifecycleOwnerAtom";
import * as soundReader from "~/application-settings/fx/readSoundSettingsFx";

vi.mock("~/launcher/fx/prepareLauncherHeroFx", () => ({
	prepareLauncherHeroFx: ({ fallbackUrl }: { fallbackUrl: string }) =>
		Effect.succeed({
			url: fallbackUrl,
		}),
}));

const registries: AtomRegistry.AtomRegistry[] = [];
const catalog: SerapackCatalog = {
	awaitIdleFx: Effect.void,
	state: Effect.runSync(
		SubscriptionRef.make<SerapackCatalog.State>({
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
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

const prepareDefaultStartupFn = () => {
	const registry = AtomRegistry.make({
		defaultIdleTTL: 400,
		scheduleTask,
	});
	registries.push(registry);
	registry.set(SerapackCatalogOwnerAtom, {
		...catalog,
		state: Effect.runSync(
			SubscriptionRef.make<SerapackCatalog.State>({
				type: "ready",
				serapacks: [],
			}),
		),
	});
	registry.set(RendererLifecycleOwnerAtom, {
		forceCloseFx: Effect.void,
		requestCloseFx: Effect.void,
		waitUntilVisibleFx: Effect.succeed(0),
	});
	registry.set(LauncherStartupConfigAtom, {
		heroUrl: "hero.png",
	});
	const writeSoundFn = vi.fn();
	const writeLogFn = vi.fn(() => Promise.resolve());
	const readSoundFn = vi.fn(() => Promise.reject(new Error("Sound preference IPC failed")));
	vi.stubGlobal("serakki", {
		appearance: {
			readFn: async () => "dark",
			readAccentFn: async () => "rose",
		},
		cheats: {
			readAvailableFn: async () => false,
		},
		window: {
			readModeFn: async () => "bordered",
		},
		sound: {
			readFn: readSoundFn,
			writeFn: writeSoundFn,
		},
		diagnostics: {
			writeApplicationFn: writeLogFn,
		},
	});
	return {
		registry,
		writeSoundFn,
		writeLogFn,
		readSoundFn,
	};
};

describe("LauncherStartupAtom", () => {
	it("completes the default startup with logged sound defaults after a preference read rejection without writing them", async () => {
		const { registry, writeSoundFn, writeLogFn, readSoundFn } = prepareDefaultStartupFn();
		registry.mount(LauncherStartupAtom);
		await vi.waitFor(() => {
			const startup = registry.get(LauncherStartupAtom);
			expect(AsyncResult.isSuccess(startup) && !startup.waiting).toBe(true);
			if (AsyncResult.isSuccess(startup))
				expect(startup.value.sound).toEqual(defaultSoundSettings);
		});
		expect(registry.get(SoundSettingsAtom)).toEqual(defaultSoundSettings);
		expect(readSoundFn).toHaveBeenCalledOnce();
		expect(writeSoundFn).not.toHaveBeenCalled();
		expect(writeLogFn).toHaveBeenCalledWith(
			expect.objectContaining({
				level: "warning",
				body: expect.stringContaining("Sound preference IPC failed"),
			}),
		);
	});

	it("does not turn sound-reader defects into a successful startup", async () => {
		const { registry, writeLogFn } = prepareDefaultStartupFn();
		const defect = new Error("Unexpected sound-reader defect");
		vi.spyOn(soundReader, "readSoundSettingsFx").mockReturnValue(Effect.die(defect));
		registry.mount(LauncherStartupAtom);
		await vi.waitFor(() => {
			const startup = registry.get(LauncherStartupAtom);
			expect(AsyncResult.isFailure(startup) && !startup.waiting).toBe(true);
			if (AsyncResult.isFailure(startup)) expect(Cause.squash(startup.cause)).toBe(defect);
		});
		expect(writeLogFn).not.toHaveBeenCalled();
	});

	it("runs one initial bootstrap and records idempotent splash completion", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(SerapackCatalogOwnerAtom, catalog);
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
					sound: {
						master: 100,
						music: 100,
						sfx: 100,
					},
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
		registry.set(SerapackCatalogOwnerAtom, catalog);
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
							sound: {
								master: 100,
								music: 100,
								sfx: 100,
							},
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
		registry.set(SerapackCatalogOwnerAtom, catalog);
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
						sound: {
							master: 100,
							music: 100,
							sfx: 100,
						},
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
		registry.set(SerapackCatalogOwnerAtom, catalog);
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "hero.png",
			bootstrapFx: Effect.succeed({
				appearance: {
					theme: "light" as const,
					accent: "blue" as const,
				},
				defaultPackageId: "built-in",
				cheatsAvailable: true,
				sound: {
					master: 100,
					music: 100,
					sfx: 100,
				},
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
		registry.set(SerapackCatalogOwnerAtom, catalog);
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
