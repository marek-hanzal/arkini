// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";
import { ArkpackCatalogAtom } from "~/bridge/arkpack/ArkpackCatalogAtom";
import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";
import { createArkpackCatalogFx } from "~/bridge/arkpack/createArkpackCatalogFx";
import { createRendererLifecycleFx } from "~/bridge/lifecycle/createRendererLifecycleFx";
import { RendererLifecycleOwnerAtom } from "~/bridge/lifecycle/RendererLifecycleOwnerAtom";
import { LauncherStartupAtom } from "~/ui/launcher/LauncherStartupAtom";
import { LauncherStartupConfigAtom } from "~/ui/launcher/LauncherStartupConfigAtom";

vi.mock("~/bridge/appearance/readAppearanceAccentFx", () => ({
	readAppearanceAccentFx: () => Effect.succeed("rose"),
}));
vi.mock("~/bridge/appearance/readAppearanceThemeFx", () => ({
	readAppearanceThemeFx: () => Effect.succeed("dark"),
}));
vi.mock("~/bridge/cheat/readCheatAvailabilityFx", () => ({
	readCheatAvailabilityFx: () => Effect.succeed(false),
}));
vi.mock("~/ui/launcher/LauncherHeroAtom", () => ({
	LauncherHeroAtom: Atom.make(
		Effect.succeed({
			owned: false,
			url: "/hero.png",
		}),
	),
}));

const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("Launcher catalog integration", () => {
	it("drives launcher bootstrap and the Arkpacks projection from one configured owner", async () => {
		const list = vi.fn(() => [
			ArkiniArkpack.descriptor,
		]);
		const catalog = Effect.runSync(
			createArkpackCatalogFx({
				listFx: Effect.sync(list),
			}),
		);
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(ArkpackCatalogOwnerAtom, catalog);
		registry.set(
			RendererLifecycleOwnerAtom,
			Effect.runSync(
				createRendererLifecycleFx({
					forceClose: () => undefined,
					requestClose: () => Promise.resolve(),
					waitUntilVisible: () => Promise.resolve(performance.now()),
				}),
			),
		);
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "/hero.png",
		});
		registry.mount(ArkpackCatalogAtom);
		registry.mount(LauncherStartupAtom);

		await Effect.runPromise(
			AtomRegistry.getResult(registry, LauncherStartupAtom, {
				suspendOnWaiting: true,
			}),
		);

		const startup = registry.get(LauncherStartupAtom);
		if (!AsyncResult.isSuccess(startup)) throw new Error("Expected successful startup.");
		expect(startup.value.builtInPackageId).toBe(ArkiniArkpack.packageId);
		expect(registry.get(ArkpackCatalogOwnerAtom)).toBe(catalog);
		expect(registry.get(ArkpackCatalogAtom)).toEqual({
			type: "ready",
			arkpacks: [
				ArkiniArkpack.descriptor,
			],
		});
		expect(list).toHaveBeenCalledOnce();
	});
});
