// @vitest-environment jsdom

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";

const harness = vi.hoisted(() => ({
	lastPackageId: "package:last" as string | null,
	loadFailure: undefined as Error | undefined,
	loadedPackageIds: [] as string[],
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
		}),
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
	harness.preloadedUrls.length = 0;
	vi.restoreAllMocks();
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {},
	});
});

describe("createLauncherStartupFx package Hero", () => {
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
});
