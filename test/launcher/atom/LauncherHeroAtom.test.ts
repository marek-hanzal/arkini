// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import { Effect, SubscriptionRef } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SerapackCatalog } from "~/serapack-catalog/service/SerapackCatalog";
import { SerapackCatalogOwnerAtom } from "~/serapack-catalog/atom/SerapackCatalogOwnerAtom";
import { createRendererLifecycleFx } from "~/application-runtime/fx/createRendererLifecycleFx";
import { RendererLifecycleOwnerAtom } from "~/application-runtime/atom/RendererLifecycleOwnerAtom";
import { LauncherAccentReadyAtom } from "~/launcher/atom/LauncherAccentReadyAtom";
import { LauncherHeroReadyAtom } from "~/launcher/atom/LauncherHeroReadyAtom";
import { LauncherHeroUrlAtom } from "~/launcher/atom/LauncherHeroUrlAtom";
import { LauncherStartupAtom } from "~/launcher/atom/LauncherStartupAtom";
import { LauncherStartupConfigAtom } from "~/launcher/atom/LauncherStartupConfigAtom";
import { retryLauncherStartupAtom } from "~/launcher/atom/retryLauncherStartupAtom";
import { testSerapackConfig } from "~test/serapack-support/fx/createTestSerapack";

const harness = vi.hoisted(() => ({
	lastPackageId: "package:last" as string | null,
	loadFailure: undefined as Error | undefined,
	loadedPackageIds: [] as string[],
	preloadInterruptions: 0,
	preloadPromise: undefined as Promise<void> | undefined,
	preloadedUrls: [] as string[],
}));

vi.mock("~/application-settings/fx/readAppearanceAccentFx", () => ({
	readAppearanceAccentFx: () => Effect.succeed("rose"),
}));
vi.mock("~/application-settings/fx/readCheatAvailabilityFx", () => ({
	readCheatAvailabilityFx: () => Effect.succeed(false),
}));
vi.mock("~/application-settings/fx/readSoundSettingsFx", () => ({
	readSoundSettingsFx: () =>
		Effect.succeed({
			master: 100,
			music: 100,
			sfx: 100,
		}),
}));
vi.mock("~/window-mode/fx/readWindowModeFx", () => ({
	readWindowModeFx: () => Effect.succeed("bordered"),
}));
vi.mock("~/installed-game/fx/readLastPackageIdFx", () => ({
	readLastPackageIdFx: () => Effect.succeed(harness.lastPackageId),
}));
vi.mock("~/serapack-catalog/fx/loadSerapackFx", () => ({
	loadSerapackFx: ({ packageId }: { readonly packageId: string }) =>
		Effect.suspend(() => {
			harness.loadedPackageIds.push(packageId);
			if (harness.loadFailure !== undefined) return Effect.fail(harness.loadFailure);
			return Effect.succeed({
				descriptor: {
					packageId,
				},
				payload: {
					config: testSerapackConfig,
					resources: [
						{
							uid: "hero",
							type: "image",
							url: "serakki://test/hero",
						},
					],
				},
			});
		}),
}));
vi.mock("~/launcher/fx/preloadLauncherHeroFx", () => ({
	preloadLauncherHeroFx: ({ url }: { readonly url: string }) =>
		Effect.sync(() => {
			harness.preloadedUrls.push(url);
		}).pipe(
			Effect.andThen(
				harness.preloadPromise === undefined
					? Effect.void
					: Effect.promise((_signal) => harness.preloadPromise!).pipe(
							Effect.onInterrupt(() =>
								Effect.sync(() => {
									harness.preloadInterruptions += 1;
								}),
							),
						),
			),
		),
}));

const builtIn = {
	packageId: "serakki",
	contentHash: "a".repeat(64),
	title: "Serakki",
	version: "1.0",
	serakki: "1.0",
	projectRevision: 1,
	provenance: {
		type: "official" as const,
	},
	source: "bundled" as const,
};
const catalog: SerapackCatalog = {
	awaitIdleFx: Effect.void,
	state: Effect.runSync(
		SubscriptionRef.make<SerapackCatalog.State>({
			type: "ready",
			serapacks: [
				builtIn,
			],
		}),
	),
	refreshFx: Effect.void,
	importFileFx: () => Effect.die("unused"),
	installFx: () => Effect.die("unused"),
	removeFx: () => Effect.die("unused"),
};
const lifecycle = Effect.runSync(
	createRendererLifecycleFx({
		forceCloseFn: () => undefined,
		requestCloseFn: () => Promise.resolve(),
		waitUntilVisibleFn: () => Promise.resolve(performance.now()),
	}),
);

beforeEach(() => {
	harness.lastPackageId = "package:last";
	harness.loadFailure = undefined;
	harness.loadedPackageIds.length = 0;
	harness.preloadInterruptions = 0;
	harness.preloadPromise = undefined;
	harness.preloadedUrls.length = 0;
	vi.restoreAllMocks();
});

describe("LauncherHeroAtom", () => {
	it("publishes visual readiness while the remaining bootstrap is pending", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		const loadingCatalog: SerapackCatalog = {
			...catalog,
			refreshFx: Effect.never,
		};
		registry.set(SerapackCatalogOwnerAtom, loadingCatalog);
		registry.set(RendererLifecycleOwnerAtom, lifecycle);
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "/hero.png",
		});
		registry.mount(LauncherStartupAtom);

		await vi.waitFor(() => {
			expect(registry.get(LauncherAccentReadyAtom)).toBe(true);
			expect(registry.get(LauncherHeroReadyAtom)).toBe(true);
		});
		expect(registry.get(LauncherStartupAtom).waiting).toBe(true);

		registry.dispose();
	});

	it("reselects the installed Hero URL on retry", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registry.set(SerapackCatalogOwnerAtom, catalog);
		registry.set(RendererLifecycleOwnerAtom, lifecycle);
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "/hero.png",
		});
		registry.mount(LauncherStartupAtom);

		await vi.waitFor(() => {
			const startup = registry.get(LauncherStartupAtom);
			expect(AsyncResult.isSuccess(startup) && !startup.waiting).toBe(true);
		});
		expect(harness.loadedPackageIds).toEqual([
			"package:last",
		]);
		expect(harness.preloadedUrls).toEqual([
			"serakki://test/hero",
		]);
		expect(registry.get(LauncherHeroUrlAtom)).toBe("serakki://test/hero");

		harness.loadFailure = new Error("package removed");
		registry.set(retryLauncherStartupAtom, undefined);
		await vi.waitFor(() => {
			const startup = registry.get(LauncherStartupAtom);
			expect(AsyncResult.isSuccess(startup) && !startup.waiting).toBe(true);
			expect(registry.get(LauncherHeroUrlAtom)).toBe("/hero.png");
		});
		expect(harness.preloadedUrls).toEqual([
			"serakki://test/hero",
			"/hero.png",
		]);

		registry.dispose();
	});

	it("uses the public fallback when the last package is unavailable", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		harness.loadFailure = new Error("package removed");
		const createObjectUrl = vi.spyOn(URL, "createObjectURL");
		registry.set(SerapackCatalogOwnerAtom, catalog);
		registry.set(RendererLifecycleOwnerAtom, lifecycle);
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "/hero.png",
		});
		registry.mount(LauncherStartupAtom);

		await vi.waitFor(() => {
			const startup = registry.get(LauncherStartupAtom);
			expect(AsyncResult.isSuccess(startup) && !startup.waiting).toBe(true);
		});
		expect(harness.preloadedUrls).toEqual([
			"/hero.png",
		]);
		expect(createObjectUrl).not.toHaveBeenCalled();
		expect(registry.get(LauncherHeroUrlAtom)).toBe("/hero.png");

		registry.dispose();
	});

	it("interrupts an in-flight installed Hero preload when the registry is disposed", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		let resolvePreload!: () => void;
		harness.preloadPromise = new Promise<void>((resolve) => {
			resolvePreload = resolve;
		});
		registry.set(SerapackCatalogOwnerAtom, catalog);
		registry.set(RendererLifecycleOwnerAtom, lifecycle);
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "/hero.png",
		});
		registry.mount(LauncherStartupAtom);
		await vi.waitFor(() =>
			expect(harness.preloadedUrls).toEqual([
				"serakki://test/hero",
			]),
		);

		registry.dispose();
		await vi.waitFor(() => {
			expect(harness.preloadInterruptions).toBe(1);
		});
		resolvePreload();
		await Promise.resolve();
	});
});
