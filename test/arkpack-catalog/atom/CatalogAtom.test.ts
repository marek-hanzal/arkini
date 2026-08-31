import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it } from "vitest";

import { CatalogAtom } from "~/arkpack-catalog/atom/CatalogAtom";
import { ArkpackCatalogOwnerAtom } from "~/arkpack-catalog/atom/ArkpackCatalogOwnerAtom";
import { createArkpackCatalogFx } from "~/arkpack-catalog/fx/createArkpackCatalogFx";

const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("CatalogAtom", () => {
	it("projects authoritative catalog refreshes through the real registry", async () => {
		const catalog = Effect.runSync(
			createArkpackCatalogFx({
				listFx: Effect.succeed([]),
			}),
		);
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(ArkpackCatalogOwnerAtom, catalog);
		registry.mount(CatalogAtom);
		await Effect.runPromise(catalog.refreshFx);

		expect(registry.get(CatalogAtom)).toEqual({
			type: "ready",
			arkpacks: [],
		});
	});
});
