// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArkiniDefaultPackageId } from "~shared/ArkiniAppMetadata";
import { CatalogAtom } from "~/arkpack-catalog/atom/CatalogAtom";
import { ArkpackCatalogOwnerAtom } from "~/arkpack-catalog/atom/ArkpackCatalogOwnerAtom";
import { createArkpackCatalogFx } from "~/arkpack-catalog/fx/createArkpackCatalogFx";
import { createRendererLifecycleFx } from "~/application-runtime/fx/createRendererLifecycleFx";
import { RendererLifecycleOwnerAtom } from "~/application-runtime/atom/RendererLifecycleOwnerAtom";
import { LauncherStartupAtom } from "~/launcher/atom/LauncherStartupAtom";
import { LauncherStartupConfigAtom } from "~/launcher/atom/LauncherStartupConfigAtom";

vi.mock("~/application-settings/fx/readAppearanceAccentFx", () => ({
	readAppearanceAccentFx: () => Effect.succeed("rose"),
}));
vi.mock("~/application-settings/fx/readAppearanceThemeFx", () => ({
	readAppearanceThemeFx: () => Effect.succeed("dark"),
}));
vi.mock("~/application-settings/fx/readCheatAvailabilityFx", () => ({
	readCheatAvailabilityFx: () => Effect.succeed(false),
}));
vi.mock("~/window-mode/fx/readWindowModeFx", () => ({
	readWindowModeFx: () => Effect.succeed("bordered"),
}));
vi.mock("~/launcher/atom/LauncherHeroAtom", () => ({
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
	it("reaches the launcher with an empty catalog so the user can repair it", async () => {
		const list = vi.fn(() => []);
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
					forceCloseFn: () => undefined,
					requestCloseFn: () => Promise.resolve(),
					waitUntilVisibleFn: () => Promise.resolve(performance.now()),
				}),
			),
		);
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "/hero.png",
		});
		registry.mount(CatalogAtom);
		registry.mount(LauncherStartupAtom);

		await Effect.runPromise(
			AtomRegistry.getResult(registry, LauncherStartupAtom, {
				suspendOnWaiting: true,
			}),
		);

		const startup = registry.get(LauncherStartupAtom);
		if (!AsyncResult.isSuccess(startup)) throw new Error("Expected successful startup.");
		expect(startup.value.defaultPackageId).toBe(ArkiniDefaultPackageId);
		expect(registry.get(ArkpackCatalogOwnerAtom)).toBe(catalog);
		expect(registry.get(CatalogAtom)).toEqual({
			type: "ready",
			arkpacks: [],
		});
		expect(list).toHaveBeenCalledOnce();
	});
});
