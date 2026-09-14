import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { DropItemRejectedReason, DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { configInput, run } from "../support/dropItemFixture";

const board = (x: number, y: number, space: number) =>
	({
		scope: "board",
		space,
		position: {
			x,
			y,
		},
	}) as const;

const portalConfig = GameConfigSchema.parse({
	...configInput,
	meta: {
		...configInput.meta,
		id: "game:portal-drop",
	},
	items: {
		...configInput.items,
		water: {
			...configInput.items.water,
			merge: [
				{
					target: {
						type: "item",
						itemId: "portal",
					},
					action: "consume",
					effect: "keep",
				},
			],
		},
		portal: {
			...configInput.items.stone,
			uid: "portal",
			id: "portal",
			title: "Portal",
			description: "Portal",
			action: {
				type: "space",
				space: 7,
			},
			merge: [
				{
					target: {
						type: "item",
						itemId: "stone",
					},
					action: "consume",
					effect: "keep",
				},
			],
		},
		inventoryOnly: {
			...configInput.items.water,
			uid: "inventoryOnly",
			id: "inventoryOnly",
			title: "Inventory only",
			description: "Inventory only",
			scope: "inventory",
		},
	},
});

const dropOntoFx = Effect.fn("dropOntoFx")(function* ({
	sourceId,
	targetId,
}: {
	readonly sourceId: string;
	readonly targetId: string;
}) {
	const runtime = yield* readRuntimeFx();
	const source = runtime.items.find((item) => item.id === sourceId);
	const target = runtime.items.find((item) => item.id === targetId);
	if (
		source === undefined ||
		target === undefined ||
		!("position" in source.location) ||
		!("position" in target.location)
	) {
		return yield* Effect.die(new Error("Portal drop test actor is missing from the grid."));
	}
	return yield* dropItemFx({
		sourceItemId: source.id,
		sourceRevision: source.revision,
		sourceLocation: source.location,
		target: {
			kind: "slot",
			location: target.location,
			occupant: {
				itemId: target.id,
				revision: target.revision,
			},
		},
	});
});

describe("dropItemFx / portal direction", () => {
	it("moves the source identity to the first free cell on the portal Board before merge", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: board(0, 0, 0),
					quantity: 2,
				});
				const portal = yield* spawnItemFx({
					id: "runtime:portal",
					itemId: "portal",
					location: board(1, 0, 0),
					quantity: 1,
				});
				const outcome = yield* dropOntoFx({
					sourceId: source.id,
					targetId: portal.id,
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
					portal,
					source,
				};
			}),
			portalConfig,
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.Move,
			itemId: result.source.id,
			previousLocation: board(0, 0, 0),
			location: board(0, 0, 7),
		});
		expect(result.runtime.currentSpace).toBe(0);
		expect(result.runtime.items).toHaveLength(2);
		expect(result.runtime.items.find((item) => item.id === result.source.id)).toMatchObject({
			id: result.source.id,
			item: {
				id: "water",
			},
			location: board(0, 0, 7),
			quantity: 2,
		});
		expect(result.runtime.items.find((item) => item.id === result.portal.id)).toEqual(
			result.portal,
		);
	});

	it("keeps portal-as-source drops directional and resolves the portal merge", () => {
		const result = run(
			Effect.gen(function* () {
				const portal = yield* spawnItemFx({
					id: "runtime:portal",
					itemId: "portal",
					location: board(0, 0, 0),
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: board(1, 0, 0),
					quantity: 1,
				});
				return yield* dropOntoFx({
					sourceId: portal.id,
					targetId: target.id,
				});
			}),
			portalConfig,
		);

		expect(result).toMatchObject({
			kind: DropItemResultKind.Merge,
			source: {
				itemId: "runtime:portal",
				current: null,
			},
			target: {
				itemId: "runtime:stone",
				current: {
					itemId: "runtime:stone",
				},
			},
		});
	});

	it("rejects atomically when the destination Board has no free cell", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: board(0, 0, 0),
					quantity: 1,
				});
				const portal = yield* spawnItemFx({
					id: "runtime:portal",
					itemId: "portal",
					location: board(1, 0, 0),
					quantity: 1,
				});
				for (let y = 0; y < 2; y += 1) {
					for (let x = 0; x < 3; x += 1) {
						yield* spawnItemFx({
							id: `runtime:blocker:${x}:${y}`,
							itemId: "stone",
							location: board(x, y, 7),
							quantity: 1,
						});
					}
				}
				const before = yield* readRuntimeFx();
				const outcome = yield* dropOntoFx({
					sourceId: source.id,
					targetId: portal.id,
				});
				return {
					before,
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
			portalConfig,
		);

		expect(result.outcome).toEqual({
			kind: DropItemResultKind.Reject,
			reason: DropItemRejectedReason.Blocked,
			itemId: "runtime:water",
			targetItemId: "runtime:portal",
		});
		expect(result.runtime).toEqual(result.before);
	});

	it("rejects an item whose authored scope cannot enter a Board", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:inventory",
					itemId: "inventoryOnly",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				const portal = yield* spawnItemFx({
					id: "runtime:portal",
					itemId: "portal",
					location: board(1, 0, 0),
					quantity: 1,
				});
				return yield* dropOntoFx({
					sourceId: source.id,
					targetId: portal.id,
				});
			}),
			portalConfig,
		);

		expect(result).toEqual({
			kind: DropItemResultKind.Reject,
			reason: DropItemRejectedReason.InvalidTarget,
			itemId: "runtime:inventory",
			targetItemId: "runtime:portal",
		});
	});
});
