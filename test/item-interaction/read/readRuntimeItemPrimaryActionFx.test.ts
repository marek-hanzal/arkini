import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { readRuntimeItemPrimaryActionFx } from "~/item-interaction/read/readRuntimeItemPrimaryActionFx";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { startFx } from "~/game-start/startFx";

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:item-primary-action",
		title: "Item primary action",
		board: {
			width: 3,
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
			{
				itemId: "satchel-control",
				space: 0,
				x: 2,
				y: 0,
			},
		],
	},
	items: {
		producer: {
			uid: "producer",
			id: "producer",
			type: "producer",
			title: "Producer",
			description: "Produces resources.",
			asset: {
				default: [
					"asset:producer",
				],
			},
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				{
					id: "line:produce",
					title: "Produce",
					description: "Produce one resource.",
					default: true,
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
			uid: "resource",
			id: "resource",
			type: "simple",
			title: "Resource",
			description: "One resource.",
			asset: {
				default: [
					"asset:resource",
				],
			},
			scope: "any",
			maxStackSize: 10,
		},
		"satchel-control": {
			uid: "satchel-control",
			id: "satchel-control",
			type: "inventory",
			title: "Satchel",
			description: "Opens the shared inventory.",
			asset: {
				default: [
					"asset:satchel",
				],
			},
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
const inventoryOpener = runtime.items.find((item) => item.item.id === "satchel-control");
if (producer === undefined || resource === undefined || inventoryOpener === undefined) {
	throw new Error("Missing fixtures.");
}

describe("readRuntimeItemPrimaryActionFx", () => {
	it("does nothing for ordinary items and uses an authored owner fallback", () => {
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
			kind: "enqueue-default-line",
			lineId: "line:produce",
			queue: {
				available: true,
				capacity: 1,
				used: 0,
			},
		});
	});

	it("opens Inventory by canonical item type from either Board or Toolbar", () => {
		expect(
			Effect.runSync(
				readRuntimeItemPrimaryActionFx({
					item: inventoryOpener,
					runtime,
				}),
			),
		).toEqual({
			kind: "open-inventory",
		});
		expect(
			Effect.runSync(
				readRuntimeItemPrimaryActionFx({
					item: {
						...inventoryOpener,
						location: {
							scope: "toolbar",
							position: {
								x: 0,
								y: 0,
							},
						},
					},
					runtime,
				}),
			),
		).toEqual({
			kind: "open-inventory",
		});
	});

	it("enqueues only a valid save-backed default line", () => {
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
			kind: "enqueue-default-line",
			lineId: "line:produce",
			queue: {
				available: true,
				capacity: 1,
				used: 0,
			},
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
			kind: "none",
		});
		expect(
			Effect.runSync(
				readRuntimeItemPrimaryActionFx({
					item: producer,
					runtime: {
						...runtime,
						defaultLineByOwnerItemId: {
							[producer.id]: null,
						},
					},
				}),
			),
		).toEqual({
			kind: "none",
		});
	});

	it("projects the canonical active-job and waiting-row capacity state", () => {
		expect(
			Effect.runSync(
				readRuntimeItemPrimaryActionFx({
					item: producer,
					runtime: {
						...runtime,
						jobQueue: [
							{
								id: "queue:producer",
								lineId: "line:produce",
								ownerItemId: producer.id,
							},
						],
					},
				}),
			),
		).toEqual({
			kind: "enqueue-default-line",
			lineId: "line:produce",
			queue: {
				available: false,
				capacity: 1,
				used: 1,
			},
		});
	});
});
