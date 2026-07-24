// @vitest-environment jsdom

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";

const harness = vi.hoisted(() => ({
	lastPackageId: "package:last" as string | null,
	loadFailure: undefined as Error | undefined,
	loadedPackageIds: [] as string[],
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
vi.mock("~/bridge/launcher/readLastPackageIdFx", () => ({
	readLastPackageIdFx: () => Effect.succeed(harness.lastPackageId),
}));
vi.mock("~/bridge/arkpack/resolveBuiltInArkpackFx", () => ({
	resolveBuiltInArkpackFx: (
		arkpacks: ReadonlyArray<{
			readonly packageId: string;
		}>,
	) => Effect.succeed(arkpacks[0]),
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
			Effect.zipRight(
				harness.preloadPromise === undefined
					? Effect.void
					: Effect.promise(() => harness.preloadPromise!),
			),
		),
}));

import { createLauncherStartupFx } from "~/ui/launcher/createLauncherStartupFx";

const builtIn = {
	packageId: "arkini",
	contentHash: "a".repeat(64),
	gameId: "arkini",
	title: "Arkini",
	configVersion: "1.0",
	compressedSize: 1,
	trust: {
		type: "official" as const,
		keyId: "arkini-test",
	},
	source: "built-in" as const,
};
const catalog: ArkpackCatalog = {
	getSnapshot: () => ({
		type: "ready",
		arkpacks: [
			builtIn,
		],
	}),
	refreshFx: Effect.void,
	importFileFx: () => Effect.die("unused"),
	removeFx: () => Effect.die("unused"),
	subscribe: () => () => undefined,
};

beforeEach(() => {
	harness.lastPackageId = "package:last";
	harness.loadFailure = undefined;
	harness.loadedPackageIds.length = 0;
	harness.preloadPromise = undefined;
	harness.preloadedUrls.length = 0;
	vi.restoreAllMocks();
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {},
	});
});

describe("createLauncherStartupFx package Hero", () => {
	it("makes the hydrated splash visuals ready while the remaining bootstrap is still loading", async () => {
		const loadingCatalog: ArkpackCatalog = {
			...catalog,
			refreshFx: Effect.never,
		};
		const startup = Effect.runSync(
			createLauncherStartupFx({
				catalog: loadingCatalog,
				heroUrl: "/hero.png",
			}),
		);
		const hydration: {
			appearance?: LauncherStartup.Appearance;
			cheatsAvailable?: boolean;
		} = {};
		const start = Effect.runPromise(startup.startFx).catch(() => undefined);

		await vi.waitFor(() => {
			startup.consumeHydration((pending) => Object.assign(hydration, pending));
			expect(hydration).toEqual({
				appearance: {
					theme: "dark",
					accent: "rose",
				},
				cheatsAvailable: false,
			});
		});
		expect(hydration).toEqual({
			appearance: {
				theme: "dark",
				accent: "rose",
			},
			cheatsAvailable: false,
		});
		expect(startup.getSnapshot()).toMatchObject({
			type: "loading",
			appearanceReady: true,
			heroReady: true,
		});

		await Effect.runPromise(startup.disposeFx);
		await start;
	});

	it("preloads and owns the Hero selected by lastPackageId", async () => {
		const createObjectUrl = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValue("blob:package-hero");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
		const startup = Effect.runSync(
			createLauncherStartupFx({
				catalog,
				heroUrl: "/hero.png",
			}),
		);

		await Effect.runPromise(startup.startFx);

		expect(harness.loadedPackageIds).toEqual([
			"package:last",
		]);
		expect(createObjectUrl).toHaveBeenCalledOnce();
		expect(createObjectUrl.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
		expect(harness.preloadedUrls).toEqual([
			"blob:package-hero",
		]);
		expect(startup.getHeroUrl()).toBe("blob:package-hero");
		expect(startup.getSnapshot()).toMatchObject({
			type: "ready",
			builtInPackageId: "arkini",
			heroReady: true,
		});

		harness.loadFailure = new Error("package removed");
		await Effect.runPromise(startup.retryFx);
		expect(harness.preloadedUrls).toEqual([
			"blob:package-hero",
			"/hero.png",
		]);
		expect(startup.getHeroUrl()).toBe("/hero.png");
		expect(revokeObjectUrl).toHaveBeenCalledOnce();
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:package-hero");

		Effect.runSync(startup.disposeFx);
		expect(revokeObjectUrl).toHaveBeenCalledOnce();
		expect(startup.getHeroUrl()).toBe("/hero.png");
	});

	it("keeps startup healthy on the public fallback when the last package is unavailable", async () => {
		harness.loadFailure = new Error("package removed");
		const createObjectUrl = vi.spyOn(URL, "createObjectURL");
		const startup = Effect.runSync(
			createLauncherStartupFx({
				catalog,
				heroUrl: "/hero.png",
			}),
		);

		await Effect.runPromise(startup.startFx);

		expect(harness.preloadedUrls).toEqual([
			"/hero.png",
		]);
		expect(createObjectUrl).not.toHaveBeenCalled();
		expect(startup.getHeroUrl()).toBe("/hero.png");
		expect(startup.getSnapshot()).toMatchObject({
			type: "ready",
			heroReady: true,
		});
	});

	it("revokes an in-flight package Hero and blocks late HMR publication after disposal", async () => {
		let resolvePreload!: () => void;
		harness.preloadPromise = new Promise<void>((resolve) => {
			resolvePreload = resolve;
		});
		const createObjectUrl = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValue("blob:pending-package-hero");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
		const startup = Effect.runSync(
			createLauncherStartupFx({
				catalog,
				heroUrl: "/hero.png",
			}),
		);
		const publication = vi.fn();
		startup.subscribe(publication);
		const start = Effect.runPromise(startup.startFx).catch(() => undefined);
		await vi.waitFor(() =>
			expect(harness.preloadedUrls).toEqual([
				"blob:pending-package-hero",
			]),
		);

		await Effect.runPromise(startup.disposeFx);
		await start;
		expect(createObjectUrl).toHaveBeenCalledOnce();
		expect(revokeObjectUrl).toHaveBeenCalledOnce();
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:pending-package-hero");
		expect(startup.getHeroUrl()).toBe("/hero.png");
		const stateAfterDispose = startup.getSnapshot();
		const publicationsAfterDispose = publication.mock.calls.length;

		resolvePreload();
		await Promise.resolve();
		await Promise.resolve();

		expect(startup.getHeroUrl()).toBe("/hero.png");
		expect(startup.getSnapshot()).toBe(stateAfterDispose);
		expect(publication).toHaveBeenCalledTimes(publicationsAfterDispose);
	});
});
