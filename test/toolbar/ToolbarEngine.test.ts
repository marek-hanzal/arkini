import { Effect, type Layer } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import type { GameLayerFx } from "~test/support/game/GameLayerFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { checkRuntimeFx } from "~/game-runtime/check/checkRuntimeFx";
import { planDropPlacementFx } from "~/item-placement/fx/planDropPlacementFx";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { moveRuntimeItemForTestFx } from "~test/item-interaction/support/moveRuntimeItemForTestFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { StateSchema } from "~/game-persistence/schema/StateSchema";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import { DropItemRejectedReason } from "~/item-interaction/type/DropItemResult";

const configInput = {
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:toolbar",
		title: "Toolbar",
		board: {
			width: 3,
			height: 2,
		},
		inventory: {
			width: 1,
			height: 1,
		},
		toolbarSize: 2,
	},
	start: {
		currentSpace: 0,
	},
	items: {
		water: {
			uid: "water",
			id: "water",
			type: "simple",
			title: "Water",
			description: "Water",
			asset: {
				default: [
					"asset:water",
				],
			},
			scope: "any",
			maxStackSize: 10,
		},
		stone: {
			uid: "stone",
			id: "stone",
			type: "simple",
			title: "Stone",
			description: "Stone",
			asset: {
				default: [
					"asset:stone",
				],
			},
			scope: "any",
			maxStackSize: 10,
		},
		boardOnly: {
			uid: "boardOnly",
			id: "boardOnly",
			type: "simple",
			title: "Board only",
			description: "Board only",
			asset: {
				default: [
					"asset:board-only",
				],
			},
			scope: "board",
			maxStackSize: 1,
		},
		inventoryOnly: {
			uid: "inventoryOnly",
			id: "inventoryOnly",
			type: "simple",
			title: "Inventory only",
			description: "Inventory only",
			asset: {
				default: [
					"asset:inventory-only",
				],
			},
			scope: "inventory",
			maxStackSize: 1,
		},
		backpack: {
			uid: "backpack",
			id: "backpack",
			type: "inventory",
			title: "Backpack",
			description: "Backpack",
			asset: {
				default: [
					"asset:backpack",
				],
			},
		},
	},
} as const;

const config = GameConfigSchema.parse(configInput);
const board = (x: number, y: number, space = 0) => ({
	scope: "board" as const,
	space,
	position: {
		x,
		y,
	},
});
const toolbar = (x: number) => ({
	scope: "toolbar" as const,
	position: {
		x,
		y: 0,
	},
});
const run = <A, E>(effect: Effect.Effect<A, E, Layer.Success<ReturnType<typeof GameLayerFx>>>) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config,
			}),
		),
	);

describe("Toolbar engine", () => {
	it("moves one live actor Board to Toolbar and back through the atomic drop command", () => {
		const result = run(
			Effect.gen(function* () {
				const sourceLocation = board(0, 0);
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const stored = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: toolbar(0),
						occupant: null,
					},
				});
				if (stored.kind !== DropItemResultKind.Move)
					throw new Error("Expected toolbar move.");
				const restored = yield* dropItemFx({
					sourceItemId: stored.itemId,
					sourceRevision: stored.revision,
					sourceLocation: stored.location,
					target: {
						kind: "slot",
						location: board(2, 1),
						occupant: null,
					},
				});
				return {
					stored,
					restored,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.stored).toMatchObject({
			kind: DropItemResultKind.Move,
			previousLocation: board(0, 0),
			location: toolbar(0),
		});
		expect(result.restored).toMatchObject({
			kind: DropItemResultKind.Move,
			previousLocation: toolbar(0),
			location: board(2, 1),
		});
		expect(result.runtime.items).toHaveLength(1);
		expect(result.runtime.items[0]?.location).toEqual(board(2, 1));
	});

	it("swaps Board and Toolbar occupants without duplicating either identity", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: board(0, 0),
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: toolbar(1),
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
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
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.Swap,
			source: {
				itemId: "runtime:water",
				location: toolbar(1),
			},
			target: {
				itemId: "runtime:stone",
				location: board(0, 0),
			},
		});
		expect(result.runtime.items.map((item) => item.id).sort()).toEqual([
			"runtime:stone",
			"runtime:water",
		]);
	});

	it("rejects a board-only item and leaves its canonical location unchanged", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:board-only",
					itemId: "boardOnly",
					location: board(1, 0),
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
					target: {
						kind: "slot",
						location: toolbar(0),
						occupant: null,
					},
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.outcome).toEqual({
			kind: DropItemResultKind.Reject,
			reason: DropItemRejectedReason.InvalidTarget,
			itemId: "runtime:board-only",
		});
		expect(result.runtime.items[0]?.location).toEqual(board(1, 0));
	});

	it("moves the inventory opener between Board and Toolbar but rejects Inventory", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:backpack",
					itemId: "backpack",
					location: board(0, 0),
					quantity: 1,
				});
				const storePreview = yield* readDropItemPreviewFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
					target: {
						kind: "slot",
						location: toolbar(1),
						occupant: null,
					},
				});
				const stored = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
					target: {
						kind: "slot",
						location: toolbar(1),
						occupant: null,
					},
				});
				if (stored.kind !== DropItemResultKind.Move) {
					throw new Error("Expected Backpack toolbar move.");
				}
				const inventoryLocation = {
					scope: "inventory" as const,
					position: {
						x: 0,
						y: 0,
					},
				};
				const preview = yield* readDropItemPreviewFx({
					sourceItemId: stored.itemId,
					sourceRevision: stored.revision,
					sourceLocation: stored.location,
					target: {
						kind: "slot",
						location: inventoryLocation,
						occupant: null,
					},
				});
				const rejected = yield* dropItemFx({
					sourceItemId: stored.itemId,
					sourceRevision: stored.revision,
					sourceLocation: stored.location,
					target: {
						kind: "slot",
						location: inventoryLocation,
						occupant: null,
					},
				});
				const afterRejected = yield* readRuntimeFx();
				const restored = yield* dropItemFx({
					sourceItemId: stored.itemId,
					sourceRevision: stored.revision,
					sourceLocation: stored.location,
					target: {
						kind: "slot",
						location: board(2, 1),
						occupant: null,
					},
				});

				return {
					afterRejected,
					preview,
					rejected,
					restored,
					runtime: yield* readRuntimeFx(),
					stored,
					storePreview,
				};
			}),
		);

		expect(result.storePreview).toEqual({
			kind: DropItemResultKind.Move,
		});
		expect(result.preview).toEqual({
			kind: DropItemResultKind.Reject,
			reason: DropItemRejectedReason.InvalidTarget,
		});
		expect(result.rejected).toEqual({
			kind: DropItemResultKind.Reject,
			reason: DropItemRejectedReason.InvalidTarget,
			itemId: "runtime:backpack",
		});
		expect(result.afterRejected.items).toEqual([
			expect.objectContaining({
				id: "runtime:backpack",
				location: toolbar(1),
				revision: result.stored.revision,
			}),
		]);
		expect(result.restored).toMatchObject({
			kind: DropItemResultKind.Move,
			previousLocation: toolbar(1),
			location: board(2, 1),
		});
		expect(result.runtime.items).toEqual([
			expect.objectContaining({
				id: "runtime:backpack",
				location: board(2, 1),
			}),
		]);
	});

	it("rejects occupied-swap previews when either resulting scope is ineligible", () => {
		const sourceRejected = run(
			Effect.gen(function* () {
				const backpack = yield* spawnItemFx({
					id: "runtime:backpack",
					itemId: "backpack",
					location: board(0, 0),
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				return yield* readDropItemPreviewFx({
					sourceItemId: backpack.id,
					sourceRevision: backpack.revision,
					sourceLocation: backpack.location,
					target: {
						kind: "slot",
						location: target.location,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				});
			}),
		);
		const targetRejected = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: toolbar(0),
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:inventory-only",
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
				return yield* readDropItemPreviewFx({
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
			}),
		);

		for (const preview of [
			sourceRejected,
			targetRejected,
		]) {
			expect(preview).toEqual({
				kind: DropItemResultKind.Reject,
				reason: DropItemRejectedReason.InvalidTarget,
			});
		}
	});

	it("uses toolbar as the final standard placement surface for any-scope output", () => {
		const plan = run(
			Effect.gen(function* () {
				for (let y = 0; y < config.meta.board.height; y += 1) {
					for (let x = 0; x < config.meta.board.width; x += 1) {
						yield* spawnItemFx({
							id: `runtime:board-blocker:${x}:${y}`,
							itemId: "stone",
							location: board(x, y),
							quantity: 10,
						});
					}
				}
				yield* spawnItemFx({
					id: "runtime:inventory-blocker",
					itemId: "stone",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 10,
				});
				return yield* planDropPlacementFx({
					drop: {
						itemId: "water",
						placement: "drop",
						quantity: 1,
					},
					origin: board(0, 0),
					runtime: yield* readRuntimeFx(),
				});
			}),
		);

		expect(plan.spawn).toEqual([
			expect.objectContaining({
				item: expect.objectContaining({
					location: toolbar(0),
					quantity: 1,
				}),
			}),
		]);
	});

	it("persists toolbar locations through the exact state round trip", () => {
		const result = run(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:persisted",
					itemId: "water",
					location: toolbar(1),
					quantity: 3,
				});
				const state = StateSchema.parse(
					fromRuntimeFn({
						runtime: yield* readRuntimeFx(),
					}),
				);
				return {
					state,
					runtime: yield* fromStateFx({
						state,
					}),
				};
			}),
		);

		expect(result.state.items[0]).toMatchObject({
			id: "runtime:persisted",
			location: toolbar(1),
			quantity: 3,
		});
		expect(result.runtime.items[0]).toMatchObject({
			id: "runtime:persisted",
			location: toolbar(1),
			quantity: 3,
		});
	});

	it("reports toolbar items out of bounds when the configured surface is disabled", () => {
		const runtime = run(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:orphaned-toolbar",
					itemId: "water",
					location: toolbar(0),
					quantity: 1,
				});
				return yield* readRuntimeFx();
			}),
		);
		const disabledConfig = GameConfigSchema.parse({
			...configInput,
			meta: {
				...configInput.meta,
				toolbarSize: 0,
			},
		});
		const { issues } = Effect.runSync(
			checkRuntimeFx({
				runtime,
			}).pipe(
				useGameFx({
					config: disabledConfig,
				}),
			),
		);

		expect(issues).toContainEqual({
			type: RuntimeCheckIssueEnumSchema.enum.LocationOutOfBounds,
			itemId: "runtime:orphaned-toolbar",
			location: toolbar(0),
			size: {
				width: 0,
				height: 1,
			},
		});
	});

	it("pauses active owner jobs in toolbar exactly like inventory", () => {
		const baseJobConfig = createJobTestConfig(2, "any");
		const jobConfig = GameConfigSchema.parse({
			...baseJobConfig,
			meta: {
				...baseJobConfig.meta,
				toolbarSize: 1,
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* startLineFx({
					ownerItemId: "runtime:forge",
					lineId: "line:forge:run",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 400,
				});
				const runtime = yield* readRuntimeFx();
				const owner = runtime.items.find((item) => item.id === "runtime:forge");
				if (owner === undefined) throw new Error("Expected forge owner.");
				const stored = yield* moveRuntimeItemForTestFx({
					itemId: owner.id,
					revision: owner.revision,
					location: toolbar(0),
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 5_000,
				});
				const paused = yield* readRuntimeFx();
				yield* moveRuntimeItemForTestFx({
					itemId: stored.item.id,
					revision: stored.item.revision,
					location: board(0, 0),
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 600,
				});
				return {
					paused,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: jobConfig,
				}),
			),
		);

		expect(result.paused.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 600,
			}),
		]);
		expect(result.runtime.jobs).toEqual([]);
	});

	it("keeps toolbar contents global when the active Board starts elsewhere", () => {
		const spaceSevenConfig = GameConfigSchema.parse({
			...configInput,
			start: {
				...configInput.start,
				currentSpace: 7,
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				const stored = yield* spawnItemFx({
					id: "runtime:stored",
					itemId: "water",
					location: toolbar(0),
					quantity: 1,
				});
				return {
					stored,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: spaceSevenConfig,
				}),
			),
		);

		expect(result.runtime.currentSpace).toBe(7);
		expect(result.runtime.items[0]).toMatchObject({
			id: result.stored.id,
			location: toolbar(0),
		});
	});
});
