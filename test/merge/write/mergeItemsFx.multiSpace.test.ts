import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { mergeItemsFx } from "~/engine/merge/write/mergeItemsFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:merge-multi-space",
		title: "Merge multi-space",
		board: {
			width: 3,
			height: 1,
		},
		inventory: {
			width: 2,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	categories: {},
	items: {
		source: {
			id: "source",
			title: "Source",
			description: "Reusable source.",
			asset: {
				source: [
					"asset:source",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 1,
			type: "simple",
			merge: [
				{
					target: {
						type: "item",
						itemId: "target",
					},
					action: "use",
					effect: "keep",
				},
			],
		},
		target: {
			id: "target",
			title: "Target",
			description: "Remote explicit target.",
			asset: {
				source: [
					"asset:target",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "board",
			maxStackSize: 1,
			type: "simple",
		},
	},
});

const state = {
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace: 0,
	items: [
		{
			id: "runtime:source",
			itemId: "source",
			location: {
				scope: "inventory",
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 1,
		},
		{
			id: "runtime:target",
			itemId: "target",
			location: {
				scope: "board",
				space: 1,
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 1,
		},
	],
	jobs: [],
} satisfies StateSchema.Type;

describe("mergeItemsFx multi-space inventory bridge", () => {
	it("allows an inventory use source to return around an explicit off-screen target", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* readRuntimeFx();
				const source = before.items.find((item) => item.id === "runtime:source");
				const target = before.items.find((item) => item.id === "runtime:target");
				if (source === undefined || target === undefined)
					throw new Error("Expected participants.");
				const event = yield* mergeItemsFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					targetItemId: target.id,
					targetRevision: target.revision,
				});
				return {
					event,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);

		expect(result.event).toMatchObject({
			type: GameEventEnumSchema.enum.ItemMerged,
			action: "use",
		});
		expect(
			result.runtime.items.some(
				(item) => item.item.id === "source" && item.location.scope === "inventory",
			),
		).toBe(false);
		expect(
			result.runtime.items.some(
				(item) =>
					item.item.id === "source" &&
					item.location.scope === "board" &&
					item.location.space === 1,
			),
		).toBe(true);
	});
});
