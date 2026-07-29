import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { readDropItemPreviewFx } from "~/engine/runtime/read/readDropItemPreviewFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { RuntimeStoreFx } from "~/engine/runtime/internal/RuntimeStoreFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { dropItemFx } from "~/engine/runtime/write/dropItemFx";
import { releaseInventoryItemFx } from "~/engine/runtime/write/releaseInventoryItemFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
import { DropItemIgnoredReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemIgnoredReasonEnumSchema";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import { inputRuntimeTestConfig } from "~test/input/support/inputRuntimeTestConfig";

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
		toolbarSize: 1,
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
const rectangleConfig = GameConfigSchema.parse({
	...configInput,
	meta: {
		...configInput.meta,
		id: "game:drop-item-rectangle",
		board: {
			width: 5,
			height: 2,
		},
	},
	items: {
		...configInput.items,
		water: {
			...configInput.items.water,
			footprint: {
				width: 2,
				height: 1,
			},
		},
	},
});
const storageRelocationConfig = GameConfigSchema.parse({
	...configInput,
	meta: {
		...configInput.meta,
		id: "game:drop-item-storage-relocation",
	},
	items: {
		...configInput.items,
		stone: {
			...configInput.items.stone,
			footprint: {
				width: 2,
				height: 1,
			},
		},
	},
});
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
const rectangleMergeConfig = GameConfigSchema.parse({
	...mergeConfig,
	meta: {
		...mergeConfig.meta,
		id: "game:drop-item-rectangle-merge",
		board: rectangleConfig.meta.board,
	},
	items: {
		...mergeConfig.items,
		water: {
			...mergeConfig.items.water,
			footprint: rectangleConfig.items.water.footprint,
		},
	},
});
const statefulRelocationConfig = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	meta: {
		...inputRuntimeTestConfig.meta,
		id: "game:drop-item-stateful-relocation",
	},
	items: {
		...inputRuntimeTestConfig.items,
		water: {
			...inputRuntimeTestConfig.items.water,
			footprint: {
				width: 2,
				height: 1,
			},
		},
		workshop: {
			...inputRuntimeTestConfig.items.workshop,
			charges: {
				amount: 3,
			},
		},
	},
});
const greedyRelocationConfig = GameConfigSchema.parse({
	...configInput,
	meta: {
		...configInput.meta,
		id: "game:drop-item-greedy-relocation",
		board: {
			width: 7,
			height: 1,
		},
		inventory: {
			width: 1,
			height: 1,
		},
		toolbarSize: 0,
	},
	items: {
		water: {
			...configInput.items.water,
			scope: "board",
			footprint: {
				width: 2,
				height: 1,
			},
		},
		stone: {
			...configInput.items.stone,
			scope: "board",
		},
		beam: {
			...configInput.items.stone,
			id: "beam",
			title: "Beam",
			description: "Beam",
			scope: "board",
			footprint: {
				width: 2,
				height: 1,
			},
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
const wideReplaceMergeConfig = GameConfigSchema.parse({
	...replaceMergeConfig,
	meta: {
		...replaceMergeConfig.meta,
		id: "game:drop-item-wide-replace-merge",
	},
	items: {
		...replaceMergeConfig.items,
		mud: {
			...replaceMergeConfig.items.mud,
			footprint: {
				width: 2,
				height: 1,
			},
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
const inventoryOpenerLocation = {
	scope: "toolbar" as const,
	position: {
		x: 0,
		y: 0,
	},
};

const stateWithItems = (items: StateSchema.Type["items"]): StateSchema.Type => ({
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace: 0,
	items,
	jobs: [],
});

const spawnInventoryOpenerFx = () =>
	spawnItemFx({
		id: "runtime:backpack",
		itemId: "backpack",
		location: inventoryOpenerLocation,
		quantity: 1,
	});

const run = <A, E, R>(effect: Effect.Effect<A, E, R>, gameConfig: GameConfigSchema.Type = config) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config: gameConfig,
			}),
		) as Effect.Effect<A, E, never>,
	);

const prepareGreedyRelocationFx = Effect.gen(function* () {
	const source = yield* spawnItemFx({
		id: "runtime:greedy-source",
		itemId: "water",
		location: sourceLocation,
		quantity: 1,
	});
	yield* spawnItemFx({
		id: "runtime:wall",
		itemId: "stone",
		location: {
			...sourceLocation,
			position: {
				x: 2,
				y: 0,
			},
		},
		quantity: 1,
	});
	const targetLocation = {
		...sourceLocation,
		position: {
			x: 4,
			y: 0,
		},
	};
	const target = yield* spawnItemFx({
		id: "runtime:greedy-target",
		itemId: "stone",
		location: targetLocation,
		quantity: 1,
	});
	const additional = yield* spawnItemFx({
		id: "runtime:greedy-additional",
		itemId: "beam",
		location: {
			...sourceLocation,
			position: {
				x: 5,
				y: 0,
			},
		},
		quantity: 1,
	});
	const command = {
		sourceItemId: source.id,
		sourceRevision: source.revision,
		sourceLocation,
		target: {
			kind: "slot" as const,
			hitLocation: targetLocation,
			location: targetLocation,
			occupant: {
				itemId: target.id,
				revision: target.revision,
			},
		},
	};
	const preview = yield* readDropItemPreviewFx(command);
	if (preview.kind !== DropItemResultKindEnumSchema.enum.Swap) {
		return yield* Effect.die(new Error(`Expected swap, received ${preview.kind}.`));
	}

	return {
		additional,
		command: {
			...command,
			target: {
				...command.target,
				expectedCollisions: preview.collisions,
			},
		},
		preview,
		source,
		target,
	};
});

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
			collisions: [],
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

		expect(preview(config)).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Swap,
		});
		expect(preview(mergeConfig)).toMatchObject({
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

		expect(result).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.StoreInventory,
		});
	});
});

describe("dropItemFx", () => {
	it("keeps the merge target identity while relocating a replacement that cannot fit its anchor", () => {
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
				yield* spawnItemFx({
					id: "runtime:blocker",
					itemId: "stone",
					location: {
						...occupiedLocation,
						position: {
							x: 2,
							y: 0,
						},
					},
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
					target,
				};
			}),
			wideReplaceMergeConfig,
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Merge,
			effect: "replace",
			target: {
				itemId: result.target.id,
				current: {
					itemId: result.target.id,
					canonicalItemId: "mud",
					location: sourceLocation,
				},
			},
		});
		expect(result.runtime.items.find(({ id }) => id === result.target.id)).toMatchObject({
			id: result.target.id,
			item: {
				id: "mud",
			},
			location: sourceLocation,
			quantity: 1,
		});
	});

	it("commits the previewed collision set and relocates every displaced identity", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:wide",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const destinationLocation = {
					...occupiedLocation,
					position: {
						x: 3,
						y: 0,
					},
				};
				const targetLocation = {
					...destinationLocation,
					position: {
						x: 4,
						y: 0,
					},
				};
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "stone",
					location: targetLocation,
					quantity: 2,
				});
				const blocker = yield* spawnItemFx({
					id: "runtime:blocker",
					itemId: "stone",
					location: destinationLocation,
					quantity: 3,
				});
				const command = {
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot" as const,
						hitLocation: targetLocation,
						location: destinationLocation,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				};
				const preview = yield* readDropItemPreviewFx(command);
				if (preview.kind !== DropItemResultKindEnumSchema.enum.Swap) {
					return yield* Effect.die(new Error(`Expected swap, received ${preview.kind}.`));
				}
				const outcome = yield* dropItemFx({
					...command,
					target: {
						...command.target,
						expectedCollisions: preview.collisions,
					},
				});
				return {
					blocker,
					outcome,
					runtime: yield* readRuntimeFx(),
					target,
				};
			}),
			rectangleConfig,
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Swap,
			relocations: [
				{
					itemId: result.target.id,
					previousLocation: {
						position: {
							x: 4,
							y: 0,
						},
					},
					location: sourceLocation,
				},
				{
					itemId: result.blocker.id,
					previousLocation: {
						position: {
							x: 3,
							y: 0,
						},
					},
				},
			],
		});
		expect(result.runtime.items.find(({ id }) => id === "runtime:wide")?.location).toEqual({
			...occupiedLocation,
			position: {
				x: 3,
				y: 0,
			},
		});
		expect(result.runtime.items.find(({ id }) => id === result.target.id)?.quantity).toBe(2);
		expect(result.runtime.items.find(({ id }) => id === result.blocker.id)?.quantity).toBe(3);
	});

	it("preserves displaced identity, quantity, state, and its owned subtree", () => {
		const state = stateWithItems([
			{
				id: "runtime:wide",
				itemId: "water",
				location: sourceLocation,
				quantity: 1,
			},
			{
				id: "runtime:blocker",
				itemId: "stone",
				location: {
					...sourceLocation,
					position: {
						x: 3,
						y: 0,
					},
				},
				quantity: 3,
			},
			{
				id: "runtime:stateful-target",
				itemId: "workshop",
				location: {
					...sourceLocation,
					position: {
						x: 4,
						y: 0,
					},
				},
				quantity: 1,
				remainingCharges: 1,
			},
			{
				id: "runtime:owned-payload",
				itemId: "water",
				location: {
					scope: "input",
					ownerItemId: "runtime:stateful-target",
					lineId: "line:workshop:build",
					inputIndex: 0,
				},
				quantity: 2,
			},
		]);
		const result = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* readRuntimeFx();
				const source = before.items.find(({ id }) => id === "runtime:wide");
				const target = before.items.find(({ id }) => id === "runtime:stateful-target");
				if (source === undefined || target === undefined) {
					return yield* Effect.die(new Error("Expected hydrated swap identities."));
				}
				const destination = {
					...sourceLocation,
					position: {
						x: 3,
						y: 0,
					},
				};
				const targetLocation = {
					...destination,
					position: {
						x: 4,
						y: 0,
					},
				};
				const command = {
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot" as const,
						hitLocation: targetLocation,
						location: destination,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				};
				const preview = yield* readDropItemPreviewFx(command);
				if (preview.kind !== DropItemResultKindEnumSchema.enum.Swap) {
					return yield* Effect.die(new Error(`Expected swap, received ${preview.kind}.`));
				}
				const outcome = yield* dropItemFx({
					...command,
					target: {
						...command.target,
						expectedCollisions: preview.collisions,
					},
				});
				return {
					after: yield* readRuntimeFx(),
					before,
					outcome,
					targetRevision: target.revision,
				};
			}).pipe(
				useGameFx({
					config: statefulRelocationConfig,
					state,
				}),
			),
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Swap,
			relocations: [
				{
					itemId: "runtime:stateful-target",
					previousLocation: {
						position: {
							x: 4,
							y: 0,
						},
					},
					location: sourceLocation,
				},
				{
					itemId: "runtime:blocker",
				},
			],
		});
		expect(result.after.items.find(({ id }) => id === "runtime:stateful-target")).toMatchObject(
			{
				id: "runtime:stateful-target",
				item: {
					id: "workshop",
				},
				location: sourceLocation,
				quantity: 1,
				remainingCharges: 1,
			},
		);
		expect(
			result.after.items.find(({ id }) => id === "runtime:stateful-target")?.revision,
		).not.toBe(result.targetRevision);
		expect(result.after.items.find(({ id }) => id === "runtime:blocker")?.quantity).toBe(3);
		expect(result.after.items.find(({ id }) => id === "runtime:owned-payload")).toEqual(
			result.before.items.find(({ id }) => id === "runtime:owned-payload"),
		);
	});

	it("rejects a destination leased by a non-relocatable Delivery origin", () => {
		const state = stateWithItems([
			{
				id: "runtime:wide",
				itemId: "water",
				location: sourceLocation,
				quantity: 1,
			},
			{
				id: "runtime:target",
				itemId: "stone",
				location: {
					...sourceLocation,
					position: {
						x: 2,
						y: 0,
					},
				},
				quantity: 1,
			},
			{
				id: "runtime:workshop",
				itemId: "workshop",
				location: {
					...sourceLocation,
					position: {
						x: 0,
						y: 1,
					},
				},
				quantity: 1,
			},
			{
				id: "runtime:delivery",
				itemId: "water",
				location: {
					scope: "delivery",
					phase: "outbound",
					generation: 0,
					origin: {
						...sourceLocation,
						position: {
							x: 3,
							y: 0,
						},
					},
					target: {
						kind: "line-input",
						ownerItemId: "runtime:workshop",
						lineId: "line:workshop:build",
						input: [
							{
								inputIndex: 0,
								quantity: 1,
							},
						],
					},
				},
				quantity: 1,
			},
		]);
		const result = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* readRuntimeFx();
				const source = before.items.find(({ id }) => id === "runtime:wide");
				const target = before.items.find(({ id }) => id === "runtime:target");
				if (source === undefined || target === undefined) {
					return yield* Effect.die(new Error("Expected hydrated drop identities."));
				}
				const destination = {
					...sourceLocation,
					position: {
						x: 2,
						y: 0,
					},
				};
				const command = {
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot" as const,
						location: destination,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				};
				const preview = yield* readDropItemPreviewFx(command);
				const outcome = yield* dropItemFx(command);
				return {
					after: yield* readRuntimeFx(),
					before,
					outcome,
					preview,
				};
			}).pipe(
				useGameFx({
					config: statefulRelocationConfig,
					state,
				}),
			),
		);

		expect(result.preview).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
		});
		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
		});
		expect(result.after).toEqual(result.before);
	});

	it("reuses released source space for the explicit target before other relocations", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:wide",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const destination = {
					...sourceLocation,
					position: {
						x: 3,
						y: 0,
					},
				};
				const targetLocation = {
					...destination,
					position: {
						x: 4,
						y: 0,
					},
				};
				const target = yield* spawnItemFx({
					id: "runtime:released-space-target",
					itemId: "stone",
					location: targetLocation,
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:released-space-additional",
					itemId: "stone",
					location: destination,
					quantity: 1,
				});
				const command = {
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot" as const,
						hitLocation: targetLocation,
						location: destination,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				};
				const preview = yield* readDropItemPreviewFx(command);
				if (preview.kind !== DropItemResultKindEnumSchema.enum.Swap) {
					return yield* Effect.die(new Error(`Expected swap, received ${preview.kind}.`));
				}
				return yield* dropItemFx({
					...command,
					target: {
						...command.target,
						expectedCollisions: preview.collisions,
					},
				});
			}),
			rectangleConfig,
		);

		expect(result).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Swap,
			relocations: [
				{
					itemId: "runtime:released-space-target",
					location: sourceLocation,
				},
				{
					itemId: "runtime:released-space-additional",
				},
			],
		});
	});

	it("keeps deterministic target-first greedy relocation without backtracking", () => {
		const result = run(
			Effect.gen(function* () {
				const prepared = yield* prepareGreedyRelocationFx;
				return {
					outcome: yield* dropItemFx(prepared.command),
					preview: prepared.preview,
					runtime: yield* readRuntimeFx(),
				};
			}),
			greedyRelocationConfig,
		);

		// Cell 3 can hold the 1 × 1 explicit target and released cells 0–1 can hold
		// the additional 2 × 1 identity. Target-first greedily takes cell 0 instead,
		// so the later identity fails; the planner intentionally does not reconsider.
		expect(
			result.runtime.items.map(({ id, location }) => ({
				id,
				location,
			})),
		).toEqual(
			expect.arrayContaining([
				{
					id: "runtime:greedy-source",
					location: sourceLocation,
				},
				{
					id: "runtime:wall",
					location: {
						...sourceLocation,
						position: {
							x: 2,
							y: 0,
						},
					},
				},
				{
					id: "runtime:greedy-target",
					location: {
						...sourceLocation,
						position: {
							x: 4,
							y: 0,
						},
					},
				},
				{
					id: "runtime:greedy-additional",
					location: {
						...sourceLocation,
						position: {
							x: 5,
							y: 0,
						},
					},
				},
			]),
		);
		expect(result.preview).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Swap,
			collisions: [
				{
					itemId: "runtime:greedy-target",
				},
				{
					itemId: "runtime:greedy-additional",
				},
			],
		});
		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
		});
	});

	it("rolls back runtime revisions, events, and item order when a later relocation fails", () => {
		const result = run(
			Effect.gen(function* () {
				const prepared = yield* prepareGreedyRelocationFx;
				const store = yield* RuntimeStoreFx;
				const before = yield* store.read;
				const outcome = yield* dropItemFx(prepared.command);
				const after = yield* store.read;
				return {
					after,
					before,
					outcome,
				};
			}),
			greedyRelocationConfig,
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
		});
		expect(result.after).toEqual(result.before);
		expect(result.after.runtime.items.map(({ id }) => id)).toEqual(
			result.before.runtime.items.map(({ id }) => id),
		);
		expect(result.after.runtime.items.map(({ revision }) => revision)).toEqual(
			result.before.runtime.items.map(({ revision }) => revision),
		);
		expect(result.after.events).toEqual(result.before.events);
	});

	it("rejects an occupied destination whose complete source rectangle is out of bounds", () => {
		const preview = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:wide",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const targetLocation = {
					scope: "board" as const,
					space: 0,
					position: {
						x: 4,
						y: 0,
					},
				};
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "stone",
					location: targetLocation,
					quantity: 1,
				});
				return yield* readDropItemPreviewFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: targetLocation,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				});
			}),
			rectangleConfig,
		);

		expect(preview).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
		});
	});

	it.each([
		{
			gameConfig: rectangleMergeConfig,
			targetItemId: "stone",
			title: "merge",
		},
		{
			gameConfig: rectangleConfig,
			targetItemId: "backpack",
			title: "Inventory storage",
		},
	])("rejects $title when the complete destination also overlaps an unrelated identity", ({
		gameConfig,
		targetItemId,
	}) => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:wide",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const destination = {
					scope: "board" as const,
					space: 0,
					position: {
						x: 3,
						y: 0,
					},
				};
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: targetItemId,
					location: destination,
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:extra",
					itemId: "stone",
					location: {
						...destination,
						position: {
							x: 4,
							y: 0,
						},
					},
					quantity: 1,
				});
				const command = {
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot" as const,
						location: destination,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				};
				const preview = yield* readDropItemPreviewFx(command);
				return {
					outcome: yield* dropItemFx(command),
					preview,
				};
			}),
			gameConfig,
		);

		expect(result.preview).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.Occupied,
		});
		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.Occupied,
		});
	});

	it("rejects a duplicate expected identity instead of authorizing an unpreviewed collision", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:wide",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const destination = {
					scope: "board" as const,
					space: 0,
					position: {
						x: 3,
						y: 0,
					},
				};
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "stone",
					location: destination,
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:extra",
					itemId: "stone",
					location: {
						...destination,
						position: {
							x: 4,
							y: 0,
						},
					},
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: destination,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
						expectedCollisions: [
							{
								itemId: target.id,
								revision: target.revision,
							},
							{
								itemId: target.id,
								revision: target.revision,
							},
						],
					},
				});
				return {
					after: yield* readRuntimeFx(),
					before,
					outcome,
				};
			}),
			rectangleConfig,
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.StaleTarget,
		});
		expect(result.after).toEqual(result.before);
	});

	it("relocates a Board-to-storage target through exact Board fallback when the old source anchor cannot fit", () => {
		const result = run(
			Effect.gen(function* () {
				const sourceLocationAtEdge = {
					scope: "board" as const,
					space: 0,
					position: {
						x: 2,
						y: 0,
					},
				};
				const toolbarLocation = {
					scope: "toolbar" as const,
					position: {
						x: 0,
						y: 0,
					},
				};
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "water",
					location: sourceLocationAtEdge,
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "stone",
					location: toolbarLocation,
					quantity: 1,
				});
				const command = {
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: sourceLocationAtEdge,
					target: {
						kind: "slot" as const,
						location: toolbarLocation,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				};
				const preview = yield* readDropItemPreviewFx(command);
				if (preview.kind !== DropItemResultKindEnumSchema.enum.Swap) {
					return yield* Effect.die(new Error(`Expected swap, received ${preview.kind}.`));
				}
				const outcome = yield* dropItemFx({
					...command,
					target: {
						...command.target,
						expectedCollisions: preview.collisions,
					},
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
			storageRelocationConfig,
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Swap,
			source: {
				location: {
					scope: "toolbar",
				},
			},
			relocations: [
				{
					itemId: "runtime:target",
					location: {
						scope: "board",
						position: {
							x: 1,
							y: 0,
						},
					},
				},
			],
		});
	});

	it("preserves runtime item order across an ordinary Board swap", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:middle",
					itemId: "water",
					location: emptyLocation,
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "stone",
					location: occupiedLocation,
					quantity: 1,
				});
				const preview = yield* readDropItemPreviewFx({
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
				if (preview.kind !== DropItemResultKindEnumSchema.enum.Swap) {
					return yield* Effect.die(new Error(`Expected swap, received ${preview.kind}.`));
				}
				yield* dropItemFx({
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
						expectedCollisions: preview.collisions,
					},
				});
				return (yield* readRuntimeFx()).items.map(({ id }) => id);
			}),
		);

		expect(result).toEqual([
			"runtime:source",
			"runtime:middle",
			"runtime:target",
		]);
	});

	it("places an inventory-scoped merge replacement through standard exact fallback", () => {
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
				const unrelated = yield* spawnItemFx({
					id: "runtime:unrelated",
					itemId: "stone",
					location: emptyLocation,
					quantity: 3,
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
					target,
					unrelated,
				};
			}),
			invalidMergeResultScopeConfig,
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Merge,
			effect: "replace",
			resultCanonicalItemId: "mud",
			source: {
				current: null,
			},
			target: {
				itemId: result.target.id,
				current: {
					itemId: result.target.id,
					canonicalItemId: "mud",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
				},
			},
		});
		expect(result.runtime.items.find(({ id }) => id === result.target.id)).toMatchObject({
			id: result.target.id,
			item: {
				id: "mud",
				scope: "inventory",
			},
			location: {
				scope: "inventory",
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 1,
		});
		expect(result.runtime.items.find(({ id }) => id === result.unrelated.id)).toEqual(
			result.unrelated,
		);
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
				const inventoryOpener = yield* spawnInventoryOpenerFx();
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
					inventoryOpenerId: inventoryOpener.id,
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
			result.outcome.events.every(
				(event) =>
					!("originItemId" in event) || event.originItemId === result.inventoryOpenerId,
			),
		).toBe(true);
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
				yield* spawnInventoryOpenerFx();
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
				yield* spawnInventoryOpenerFx();
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

	it("rejects an Inventory release without its physical opener", () => {
		const inventoryLocation = {
			scope: "inventory" as const,
			position: {
				x: 0,
				y: 0,
			},
		};
		const outcome = run(
			Effect.gen(function* () {
				const inventoryItem = yield* spawnItemFx({
					id: "runtime:inventory-water",
					itemId: "water",
					location: inventoryLocation,
					quantity: 1,
				});
				return yield* Effect.result(
					releaseInventoryItemFx({
						itemId: inventoryItem.id,
						revision: inventoryItem.revision,
						location: inventoryLocation,
					}),
				);
			}),
		);

		expect(Result.isFailure(outcome)).toBe(true);
		if (Result.isFailure(outcome)) {
			expect(outcome.failure).toMatchObject({
				_tag: "InventoryOpenerUnavailableError",
				itemId: "runtime:inventory-water",
			});
		}
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
