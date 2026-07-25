import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { readDropItemPreviewFx } from "~/engine/runtime/read/readDropItemPreviewFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { dropItemFx } from "~/engine/runtime/write/dropItemFx";
import { releaseInventoryItemFx } from "~/engine/runtime/write/releaseInventoryItemFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
import { DropItemIgnoredReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemIgnoredReasonEnumSchema";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";

const configInput = {
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:drop-item",
		title: "Drop item",
		board: {
			width: 3,
			height: 2,
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
		water: {
			id: "water",
			type: "simple",
			title: "Water",
			description: "Water",
			asset: {
				source: [
					"asset:water",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
		},
		stone: {
			id: "stone",
			type: "simple",
			title: "Stone",
			description: "Stone",
			asset: {
				source: [
					"asset:stone",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
		},
		backpack: {
			id: "backpack",
			type: "inventory",
			title: "Backpack",
			description: "Backpack",
			asset: {
				source: [
					"asset:backpack",
				],
			},
			tags: [],
			categoryId: "utility",
		},
	},
} as const;

const config = GameConfigSchema.parse(configInput);
const mergeConfig = GameConfigSchema.parse({
	...configInput,
	meta: {
		...configInput.meta,
		id: "game:drop-item-merge",
	},
	items: {
		...configInput.items,
		water: {
			...configInput.items.water,
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
	},
});

const removeMergeConfig = GameConfigSchema.parse({
	...configInput,
	meta: {
		...configInput.meta,
		id: "game:drop-item-remove-merge",
	},
	items: {
		...configInput.items,
		water: {
			...configInput.items.water,
			merge: [
				{
					target: {
						type: "item",
						itemId: "stone",
					},
					action: "consume",
					effect: "remove",
				},
			],
		},
	},
});

const replaceMergeConfig = GameConfigSchema.parse({
	...configInput,
	meta: {
		...configInput.meta,
		id: "game:drop-item-replace-merge",
	},
	items: {
		...configInput.items,
		water: {
			...configInput.items.water,
			merge: [
				{
					target: {
						type: "item",
						itemId: "stone",
					},
					action: "consume",
					effect: "replace",
					result: "mud",
				},
			],
		},
		mud: {
			...configInput.items.stone,
			id: "mud",
			title: "Mud",
			description: "Mud",
			asset: {
				source: [
					"asset:mud",
				],
			},
		},
	},
});

const invalidMergeResultScopeConfig = GameConfigSchema.parse({
	...replaceMergeConfig,
	meta: {
		...replaceMergeConfig.meta,
		id: "game:drop-item-invalid-merge-result-scope",
	},
	items: {
		...replaceMergeConfig.items,
		mud: {
			...replaceMergeConfig.items.mud,
			scope: "inventory",
		},
	},
});

const sourceLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};
const emptyLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 2,
		y: 1,
	},
};
const occupiedLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 1,
		y: 0,
	},
};

const run = <A, E, R>(effect: Effect.Effect<A, E, R>, gameConfig: GameConfigSchema.Type = config) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config: gameConfig,
			}),
		) as Effect.Effect<A, E, never>,
	);

describe("readDropItemPreviewFx", () => {
	it("reports move for one live source over an empty slot without mutating runtime", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const preview = yield* readDropItemPreviewFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: emptyLocation,
						occupant: null,
					},
				});
				return {
					preview,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.preview).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Move,
		});
		expect(result.runtime.items[0]?.location).toEqual(sourceLocation);
	});

	it("distinguishes non-combinable swap from authored merge", () => {
		const preview = (gameConfig: GameConfigSchema.Type) =>
			run(
				Effect.gen(function* () {
					const source = yield* spawnItemFx({
						id: "runtime:water",
						itemId: "water",
						location: sourceLocation,
						quantity: 1,
					});
					const target = yield* spawnItemFx({
						id: "runtime:stone",
						itemId: "stone",
						location: occupiedLocation,
						quantity: 1,
					});
					return yield* readDropItemPreviewFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						sourceLocation,
						target: {
							kind: "slot",
							location: occupiedLocation,
							occupant: {
								itemId: target.id,
								revision: target.revision,
							},
						},
					});
				}),
				gameConfig,
			);

		expect(preview(config)).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Swap,
		});
		expect(preview(mergeConfig)).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Merge,
		});
	});

	it("rejects a stale source before advertising an empty-slot move", () => {
		const preview = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				return yield* readDropItemPreviewFx({
					sourceItemId: source.id,
					sourceRevision: "revision:stale",
					sourceLocation,
					target: {
						kind: "slot",
						location: emptyLocation,
						occupant: null,
					},
				});
			}),
		);

		expect(preview).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.StaleSource,
		});
	});

	it("advertises whole-item storage instead of swapping with the Inventory opener", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 3,
				});
				const inventory = yield* spawnItemFx({
					id: "runtime:backpack",
					itemId: "backpack",
					location: occupiedLocation,
					quantity: 1,
				});
				return yield* readDropItemPreviewFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: occupiedLocation,
						occupant: {
							itemId: inventory.id,
							revision: inventory.revision,
						},
					},
				});
			}),
		);

		expect(result).toEqual({
			kind: DropItemResultKindEnumSchema.enum.StoreInventory,
		});
	});
});

describe("dropItemFx", () => {
	it("surfaces authored merge invariant failures instead of reporting a product rejection", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: occupiedLocation,
					quantity: 1,
				});
				return yield* Effect.result(
					dropItemFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						sourceLocation,
						target: {
							kind: "slot",
							location: occupiedLocation,
							occupant: {
								itemId: target.id,
								revision: target.revision,
							},
						},
					}),
				);
			}),
			invalidMergeResultScopeConfig,
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				_tag: "RuntimeInvalidError",
			});
		}
	});

	it("moves one exact source to an empty slot and returns explicit identities", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: emptyLocation,
						occupant: null,
					},
				});
				const runtime = yield* readRuntimeFx();
				return {
					outcome,
					runtime,
				};
			}),
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Move,
			itemId: "runtime:water",
			previousLocation: sourceLocation,
			location: emptyLocation,
		});
		expect(result.runtime.items[0]?.location).toEqual(emptyLocation);
	});

	it("stores the whole source stack through the Inventory opener atomically", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water-source",
					itemId: "water",
					location: sourceLocation,
					quantity: 3,
				});
				yield* spawnItemFx({
					id: "runtime:water-stack",
					itemId: "water",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 8,
				});
				const inventory = yield* spawnItemFx({
					id: "runtime:backpack",
					itemId: "backpack",
					location: occupiedLocation,
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: occupiedLocation,
						occupant: {
							itemId: inventory.id,
							revision: inventory.revision,
						},
					},
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.StoreInventory,
			source: {
				itemId: "runtime:water-source",
				previousQuantity: 3,
				current: null,
			},
			inventory: {
				itemId: "runtime:backpack",
				location: occupiedLocation,
			},
		});
		expect(
			result.runtime.items
				.filter((item) => item.item.id === "water" && item.location.scope === "inventory")
				.map((item) => item.quantity)
				.sort((left, right) => left - right),
		).toEqual([
			1,
			10,
		]);
		expect(result.runtime.items.some((item) => item.id === "runtime:water-source")).toBe(false);
	});

	it("releases the whole Inventory stack through board-first placement", () => {
		const inventoryLocation = {
			scope: "inventory" as const,
			position: {
				x: 0,
				y: 0,
			},
		};
		const result = run(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:board-water",
					itemId: "water",
					location: sourceLocation,
					quantity: 8,
				});
				const inventoryItem = yield* spawnItemFx({
					id: "runtime:inventory-water",
					itemId: "water",
					location: inventoryLocation,
					quantity: 4,
				});
				const outcome = yield* releaseInventoryItemFx({
					itemId: inventoryItem.id,
					revision: inventoryItem.revision,
					location: inventoryLocation,
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.outcome.events.map((event) => event.type)).toEqual([
			"item:stacked",
			"item:spawned",
		]);
		expect(
			result.runtime.items
				.filter((item) => item.item.id === "water")
				.map((item) => ({
					location: item.location,
					quantity: item.quantity,
				})),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					location: sourceLocation,
					quantity: 10,
				}),
				expect.objectContaining({
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 2,
				}),
			]),
		);
		expect(result.runtime.items.some((item) => item.id === "runtime:inventory-water")).toBe(
			false,
		);
	});

	it("releases into compatible Board stack capacity when every cell is occupied", () => {
		const inventoryLocation = {
			scope: "inventory" as const,
			position: {
				x: 0,
				y: 0,
			},
		};
		const result = run(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:board-water",
					itemId: "water",
					location: sourceLocation,
					quantity: 8,
				});
				let blockerIndex = 0;
				for (let y = 0; y < 2; y += 1) {
					for (let x = 0; x < 3; x += 1) {
						if (x === sourceLocation.position.x && y === sourceLocation.position.y) {
							continue;
						}
						yield* spawnItemFx({
							id: `runtime:blocker:${blockerIndex}`,
							itemId: "stone",
							location: {
								scope: "board",
								space: 0,
								position: {
									x,
									y,
								},
							},
							quantity: 1,
						});
						blockerIndex += 1;
					}
				}
				const inventoryItem = yield* spawnItemFx({
					id: "runtime:inventory-water",
					itemId: "water",
					location: inventoryLocation,
					quantity: 2,
				});
				const outcome = yield* releaseInventoryItemFx({
					itemId: inventoryItem.id,
					revision: inventoryItem.revision,
					location: inventoryLocation,
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.outcome.events.map((event) => event.type)).toEqual([
			"item:stacked",
		]);
		expect(
			result.runtime.items.find((item) => item.id === "runtime:board-water")?.quantity,
		).toBe(10);
		expect(result.runtime.items.some((item) => item.id === "runtime:inventory-water")).toBe(
			false,
		);
		expect(result.runtime.items.filter((item) => item.location.scope === "board")).toHaveLength(
			6,
		);
	});

	it("rejects a release that could only fall back into passive storage", () => {
		const inventoryLocation = {
			scope: "inventory" as const,
			position: {
				x: 0,
				y: 0,
			},
		};
		const result = run(
			Effect.gen(function* () {
				let blockerIndex = 0;
				for (let y = 0; y < 2; y += 1) {
					for (let x = 0; x < 3; x += 1) {
						yield* spawnItemFx({
							id: `runtime:blocker:${blockerIndex}`,
							itemId: "stone",
							location: {
								scope: "board",
								space: 0,
								position: {
									x,
									y,
								},
							},
							quantity: 1,
						});
						blockerIndex += 1;
					}
				}
				const inventoryItem = yield* spawnItemFx({
					id: "runtime:inventory-water",
					itemId: "water",
					location: inventoryLocation,
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const outcome = yield* Effect.result(
					releaseInventoryItemFx({
						itemId: inventoryItem.id,
						revision: inventoryItem.revision,
						location: inventoryLocation,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					before,
					outcome,
				};
			}),
		);

		expect(Result.isFailure(result.outcome)).toBe(true);
		if (Result.isFailure(result.outcome)) {
			expect(result.outcome.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
				reason: "board:full",
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("swaps two non-mergeable occupied Board items and returns both actor identities", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: occupiedLocation,
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: occupiedLocation,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Swap,
			source: {
				itemId: "runtime:water",
				previousLocation: sourceLocation,
				location: occupiedLocation,
			},
			target: {
				itemId: "runtime:stone",
				previousLocation: occupiedLocation,
				location: sourceLocation,
			},
		});
		expect(result.runtime.items.find((item) => item.id === "runtime:water")?.location).toEqual(
			occupiedLocation,
		);
		expect(result.runtime.items.find((item) => item.id === "runtime:stone")?.location).toEqual(
			sourceLocation,
		);
	});

	it("commits a matching authored merge and returns exact surviving actor identities", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: occupiedLocation,
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: occupiedLocation,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
					source,
					target,
				};
			}),
			mergeConfig,
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Merge,
			action: "consume",
			effect: "keep",
			source: {
				itemId: "runtime:water",
				previousRevision: result.source.revision,
				previousLocation: sourceLocation,
				previousQuantity: 1,
				current: null,
			},
			target: {
				itemId: "runtime:stone",
				previousRevision: result.target.revision,
				previousLocation: occupiedLocation,
				previousQuantity: 1,
				current: {
					itemId: "runtime:stone",
					canonicalItemId: "stone",
					location: occupiedLocation,
					quantity: 1,
				},
			},
		});
		expect(result.runtime.items).toHaveLength(1);
		expect(result.runtime.items[0]?.id).toBe("runtime:stone");
	});

	it("returns the surviving source stack identity after consuming one merge quantity", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 2,
				});
				const target = yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: occupiedLocation,
					quantity: 1,
				});
				return yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: occupiedLocation,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				});
			}),
			mergeConfig,
		);

		expect(result).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Merge,
			source: {
				itemId: "runtime:water",
				previousQuantity: 2,
				current: {
					itemId: "runtime:water",
					canonicalItemId: "water",
					location: sourceLocation,
					quantity: 1,
				},
			},
		});
	});

	it("keeps the target runtime identity explicit across replacement", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: occupiedLocation,
					quantity: 1,
				});
				return yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: occupiedLocation,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				});
			}),
			replaceMergeConfig,
		);

		expect(result).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Merge,
			effect: "replace",
			resultCanonicalItemId: "mud",
			source: {
				current: null,
			},
			target: {
				itemId: "runtime:stone",
				current: {
					itemId: "runtime:stone",
					canonicalItemId: "mud",
					location: occupiedLocation,
				},
			},
		});
	});

	it("merges one quantity from both stacks and places the target remainder", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 2,
				});
				const target = yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: occupiedLocation,
					quantity: 2,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: occupiedLocation,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
			replaceMergeConfig,
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Merge,
			effect: "replace",
			source: {
				itemId: "runtime:water",
				previousQuantity: 2,
				current: {
					itemId: "runtime:water",
					canonicalItemId: "water",
					location: sourceLocation,
					quantity: 1,
				},
			},
			target: {
				itemId: "runtime:stone",
				previousQuantity: 2,
				current: {
					itemId: "runtime:stone",
					canonicalItemId: "mud",
					location: occupiedLocation,
					quantity: 1,
				},
			},
		});
		const targetRemainder = result.runtime.items.find((item) => item.item.id === "stone");
		expect(targetRemainder).toMatchObject({
			location: {
				scope: "board",
				space: 0,
			},
			quantity: 1,
		});
		expect(targetRemainder?.id).not.toBe("runtime:stone");
	});

	it("reports both actor identities as removed when merge consumes and removes them", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: occupiedLocation,
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: occupiedLocation,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
			removeMergeConfig,
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Merge,
			effect: "remove",
			source: {
				itemId: "runtime:water",
				current: null,
			},
			target: {
				itemId: "runtime:stone",
				current: null,
			},
		});
		expect(result.runtime.items).toEqual([]);
	});

	it("ignores the same location without revising the item", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: sourceLocation,
						occupant: {
							itemId: source.id,
							revision: source.revision,
						},
					},
				});
				const runtime = yield* readRuntimeFx();
				return {
					outcome,
					runtime,
					source,
				};
			}),
		);

		expect(result.outcome).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Ignored,
			reason: DropItemIgnoredReasonEnumSchema.enum.SameLocation,
			itemId: "runtime:water",
			location: sourceLocation,
		});
		expect(result.runtime.items).toEqual([
			result.source,
		]);
	});

	it("rejects a stale source location instead of moving from a different live slot", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: occupiedLocation,
					target: {
						kind: "slot",
						location: emptyLocation,
						occupant: null,
					},
				});
				const runtime = yield* readRuntimeFx();
				return {
					outcome,
					runtime,
					source,
				};
			}),
		);

		expect(result.outcome).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.StaleSource,
			itemId: "runtime:water",
		});
		expect(result.runtime.items).toEqual([
			result.source,
		]);
	});

	it("rejects a stale occupied target without swapping either actor", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: occupiedLocation,
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: occupiedLocation,
						occupant: {
							itemId: target.id,
							revision: "revision:stale",
						},
					},
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
					source,
					target,
				};
			}),
		);

		expect(result.outcome).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.StaleTarget,
			itemId: "runtime:water",
			targetItemId: "runtime:stone",
		});
		expect(result.runtime.items).toEqual([
			result.source,
			result.target,
		]);
	});
});
