import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it } from "vitest";

import { CatalogAtom } from "~/serapack-catalog/atom/CatalogAtom";
import { SerapackCatalogOwnerAtom } from "~/serapack-catalog/atom/SerapackCatalogOwnerAtom";
import { createSerapackCatalogFx } from "~/serapack-catalog/fx/createSerapackCatalogFx";

const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("CatalogAtom", () => {
	it("projects authoritative catalog refreshes through the real registry", async () => {
		const catalog = Effect.runSync(
			createSerapackCatalogFx({
				listFx: Effect.succeed([]),
			}),
		);
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(SerapackCatalogOwnerAtom, catalog);
		registry.mount(CatalogAtom);
		await Effect.runPromise(catalog.refreshFx);

		expect(registry.get(CatalogAtom)).toEqual({
			type: "ready",
			serapacks: [],
		});
	});
});
