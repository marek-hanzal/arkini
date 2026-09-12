import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { readRuntimeItemPrimaryActionFx } from "~/item-interaction/fx/readRuntimeItemPrimaryActionFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { enqueueDefaultLineFx } from "~/production-job/fx/enqueueDefaultLineFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { startFx } from "~/game-start/fx/startFx";

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

			title: "Producer",
			description: "Produces resources.",
			asset: {
				scale: 0.8,
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
			maxQueueSize: 1,
			lines: [],

			uid: "resource",
			id: "resource",

			title: "Resource",
			description: "One resource.",
			asset: {
				scale: 0.8,
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
			action: {
				type: "inventory",
			},
			scope: "any",
			maxStackSize: 1,
			title: "Satchel",
			description: "Opens the shared inventory.",
			asset: {
				scale: 0.8,
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
	it("admits default production only when the Common item has lines", () => {
		const item = config.items.producer;
		if (item === undefined) throw new Error("Expected Common fixture.");
		for (const active of [
			false,
			true,
		]) {
			const result = Effect.runSync(
				Effect.gen(function* () {
					const started = yield* startFx();
					const owner = started.items.find(({ item }) => item.id === "producer");
					if (owner === undefined) throw new Error("Missing Common owner.");
					const action = yield* readRuntimeItemPrimaryActionFx({
						item: owner,
						runtime: started,
					});
					const admission = yield* Effect.result(
						enqueueDefaultLineFx({
							ownerItemId: owner.id,
						}),
					);
					return {
						action,
						admission,
						before: started,
						after: yield* readRuntimeFx(),
					};
				}).pipe(
					useGameFx({
						config: GameConfigSchema.parse({
							...config,
							items: {
								...config.items,
								producer: {
									...item,
									lines: active ? item.lines : [],
								},
							},
						}),
					}),
				),
			);
			if (active) {
				expect(result.action).toEqual({
					kind: "enqueue-default-line",
					lineId: "line:produce",
					queue: {
						available: true,
						capacity: 1,
						used: 0,
					},
				});
				expect(Result.isSuccess(result.admission)).toBe(true);
				expect(result.after.jobQueue).toHaveLength(1);
			} else {
				expect(result.action).toEqual({
					kind: "none",
				});
				expect(Result.isFailure(result.admission)).toBe(true);
				if (Result.isFailure(result.admission))
					expect(result.admission.failure).toMatchObject({
						_tag: "DefaultLineQueueUnavailableError",
					});
				expect(result.after).toEqual(result.before);
			}
		}
	});

	it("opens Inventory by its authored action from either Board or Toolbar", () => {
		expect(
			Effect.runSync(
				readRuntimeItemPrimaryActionFx({
					item: inventoryOpener,
					runtime,
				}),
			),
		).toEqual({
			kind: "open-inventory",
			currentSpace: 0,
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
			currentSpace: 0,
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
