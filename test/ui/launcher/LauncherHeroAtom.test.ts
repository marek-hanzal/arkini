// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import { Effect, SubscriptionRef } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";
import { createRendererLifecycleFx } from "~/bridge/lifecycle/createRendererLifecycleFx";
import { RendererLifecycleOwnerAtom } from "~/bridge/lifecycle/RendererLifecycleOwnerAtom";
import { LauncherAppearanceReadyAtom } from "~/ui/launcher/LauncherAppearanceReadyAtom";
import { LauncherHeroReadyAtom } from "~/ui/launcher/LauncherHeroReadyAtom";
import { LauncherHeroUrlAtom } from "~/ui/launcher/LauncherHeroUrlAtom";
import { LauncherStartupAtom } from "~/ui/launcher/LauncherStartupAtom";
import { LauncherStartupConfigAtom } from "~/ui/launcher/LauncherStartupConfigAtom";
import { retryLauncherStartupAtom } from "~/ui/launcher/retryLauncherStartupAtom";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";

const harness = vi.hoisted(() => ({
	lastPackageId: "package:last" as string | null,
	loadFailure: undefined as Error | undefined,
	loadedPackageIds: [] as string[],
	preloadInterruptions: 0,
	preloadPromise: undefined as Promise<void> | undefined,
	preloadedUrls: [] as string[],
}));

vi.mock("~/bridge/appearance/readAppearanceAccentFx", () => ({
	readAppearanceAccentFx: () => Effect.succeed("rose"),
}));
vi.mock("~/bridge/appearance/readAppearanceThemeFx", () => ({
	readAppearanceThemeFx: () => Effect.succeed("dark"),
}));
vi.mock("~/bridge/cheat/readCheatAvailabilityFx", () => ({
	readCheatAvailabilityFx: () => Effect.succeed(false),
}));
vi.mock("~/bridge/window/readWindowModeFx", () => ({
	readWindowModeFx: () => Effect.succeed("bordered"),
}));
vi.mock("~/bridge/launcher/readLastPackageIdFx", () => ({
	readLastPackageIdFx: () => Effect.succeed(harness.lastPackageId),
}));
vi.mock("~/bridge/arkpack/loadArkpackFx", () => ({
	loadArkpackFx: ({ packageId }: { readonly packageId: string }) =>
		Effect.suspend(() => {
			harness.loadedPackageIds.push(packageId);
			if (harness.loadFailure !== undefined) return Effect.fail(harness.loadFailure);
			return Effect.succeed({
				descriptor: {
					packageId,
				},
				payload: {
					config: testArkpackConfig,
					resources: [
						{
							id: "hero",
							mime: "image/png",
							bytes: Uint8Array.of(1, 2, 3),
						},
					],
				},
			});
		}),
}));
vi.mock("~/ui/launcher/preloadLauncherHeroFx", () => ({
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
	packageId: "arkini",
	contentHash: "a".repeat(64),
	title: "Arkini",
	version: "1.0",
	arkini: "1.0",
	trust: {
		type: "official" as const,
	},
	source: "bundled" as const,
};
const catalog: ArkpackCatalog = {
	awaitIdleFx: Effect.void,
	state: Effect.runSync(
		SubscriptionRef.make<ArkpackCatalog.State>({
			type: "ready",
			arkpacks: [
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
		forceClose: () => undefined,
		requestClose: () => Promise.resolve(),
		waitUntilVisible: () => Promise.resolve(performance.now()),
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
		const loadingCatalog: ArkpackCatalog = {
			...catalog,
			refreshFx: Effect.never,
		};
		registry.set(ArkpackCatalogOwnerAtom, loadingCatalog);
		registry.set(RendererLifecycleOwnerAtom, lifecycle);
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "/hero.png",
		});
		registry.mount(LauncherStartupAtom);

		await vi.waitFor(() => {
			expect(registry.get(LauncherAppearanceReadyAtom)).toBe(true);
			expect(registry.get(LauncherHeroReadyAtom)).toBe(true);
		});
		expect(registry.get(LauncherStartupAtom).waiting).toBe(true);

		registry.dispose();
	});

	it("reselects the Hero on retry and revokes the prior owned URL once", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		const createObjectUrl = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValue("blob:package-hero");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
		registry.set(ArkpackCatalogOwnerAtom, catalog);
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
		expect(createObjectUrl).toHaveBeenCalledOnce();
		expect(createObjectUrl.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
		expect(harness.preloadedUrls).toEqual([
			"blob:package-hero",
		]);
		expect(registry.get(LauncherHeroUrlAtom)).toBe("blob:package-hero");

		harness.loadFailure = new Error("package removed");
		registry.set(retryLauncherStartupAtom, undefined);
		await vi.waitFor(() => {
			const startup = registry.get(LauncherStartupAtom);
			expect(AsyncResult.isSuccess(startup) && !startup.waiting).toBe(true);
			expect(registry.get(LauncherHeroUrlAtom)).toBe("/hero.png");
		});
		expect(harness.preloadedUrls).toEqual([
			"blob:package-hero",
			"/hero.png",
		]);
		expect(revokeObjectUrl).toHaveBeenCalledOnce();
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:package-hero");

		registry.dispose();
		expect(revokeObjectUrl).toHaveBeenCalledOnce();
	});

	it("uses the public fallback when the last package is unavailable", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		harness.loadFailure = new Error("package removed");
		const createObjectUrl = vi.spyOn(URL, "createObjectURL");
		registry.set(ArkpackCatalogOwnerAtom, catalog);
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

	it("revokes an in-flight owned URL when the registry is disposed", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		let resolvePreload!: () => void;
		harness.preloadPromise = new Promise<void>((resolve) => {
			resolvePreload = resolve;
		});
		vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:pending-package-hero");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
		registry.set(ArkpackCatalogOwnerAtom, catalog);
		registry.set(RendererLifecycleOwnerAtom, lifecycle);
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "/hero.png",
		});
		registry.mount(LauncherStartupAtom);
		await vi.waitFor(() =>
			expect(harness.preloadedUrls).toEqual([
				"blob:pending-package-hero",
			]),
		);

		registry.dispose();
		await vi.waitFor(() => {
			expect(harness.preloadInterruptions).toBe(1);
			expect(revokeObjectUrl).toHaveBeenCalledOnce();
			expect(revokeObjectUrl).toHaveBeenCalledWith("blob:pending-package-hero");
		});
		resolvePreload();
		await Promise.resolve();
		expect(revokeObjectUrl).toHaveBeenCalledOnce();
	});
});
