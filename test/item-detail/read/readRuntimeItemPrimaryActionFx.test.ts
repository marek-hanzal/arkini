import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { readRuntimeItemPrimaryActionFx } from "~/engine/item-detail/read/readRuntimeItemPrimaryActionFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:item-primary-action",
		title: "Item primary action",
		board: {
			width: 2,
			height: 1,
		},
		inventory: {
			width: 1,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
		board: [
			{
				itemId: "producer",
				space: 0,
				x: 0,
				y: 0,
			},
			{
				itemId: "resource",
				space: 0,
				x: 1,
				y: 0,
			},
		],
	},
	categories: {},
	items: {
		producer: {
			id: "producer",
			type: "producer",
			title: "Producer",
			description: "Produces resources.",
			asset: {
				source: [
					"asset:producer",
				],
			},
			tags: [],
			categoryId: "building",
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				{
					id: "line:produce",
					title: "Produce",
					description: "Produce one resource.",
					runtimeMs: 1_000,
					input: [
						{
							type: "simple",
						},
					],
					rules: [],
				},
			],
		},
		resource: {
			id: "resource",
			type: "simple",
			title: "Resource",
			description: "One resource.",
			asset: {
				source: [
					"asset:resource",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
		},
	},
});

const runtime = Effect.runSync(
	startFx().pipe(
		useGameFx({
			config,
		}),
	),
);

const producer = runtime.items.find((item) => item.item.id === "producer");
const resource = runtime.items.find((item) => item.item.id === "resource");
if (producer === undefined || resource === undefined) throw new Error("Missing fixtures.");

describe("readRuntimeItemPrimaryActionFx", () => {
	it("does nothing for ordinary items and opens Lines for owners without a default", () => {
		expect(
			Effect.runSync(
				readRuntimeItemPrimaryActionFx({
					item: resource,
					runtime,
				}),
			),
		).toEqual({
			kind: "none",
		});
		expect(
			Effect.runSync(
				readRuntimeItemPrimaryActionFx({
					item: producer,
					runtime,
				}),
			),
		).toEqual({
			kind: "open-lines",
		});
	});

	it("starts only a valid save-backed default line", () => {
		expect(
			Effect.runSync(
				readRuntimeItemPrimaryActionFx({
					item: producer,
					runtime: {
						...runtime,
						defaultLineByOwnerItemId: {
							[producer.id]: "line:produce",
						},
					},
				}),
			),
		).toEqual({
			kind: "start-default-line",
			lineId: "line:produce",
		});
		expect(
			Effect.runSync(
				readRuntimeItemPrimaryActionFx({
					item: producer,
					runtime: {
						...runtime,
						defaultLineByOwnerItemId: {
							[producer.id]: "line:missing",
						},
					},
				}),
			),
		).toEqual({
			kind: "open-lines",
		});
	});
});
