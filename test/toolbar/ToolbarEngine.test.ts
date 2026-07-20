import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { readOwnerJobQueueFx } from "~/engine/job/read/readOwnerJobQueueFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { checkRuntimeLocationsFx } from "~/engine/runtime/check/checkRuntimeLocationsFx";
import { planDropScopePlacementFx } from "~/engine/placement/fx/planDropScopePlacementFx";
import { fromStateFx } from "~/engine/runtime/fx/fromStateFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { dropItemFx } from "~/engine/runtime/write/dropItemFx";
import { moveItemFx } from "~/engine/runtime/write/moveItemFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { setCurrentSpaceFx } from "~/engine/space/write/setCurrentSpaceFx";
import { fromRuntimeFx } from "~/engine/state/fx/fromRuntimeFx";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";
import { StateSchema } from "~/engine/state/schema/StateSchema";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";

const configInput = {
	version: "1.0",
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
		boardOnly: {
			id: "boardOnly",
			type: "simple",
			title: "Board only",
			description: "Board only",
			asset: {
				source: [
					"asset:board-only",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "board",
			maxStackSize: 1,
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
const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config,
			}),
		) as Effect.Effect<A, E, never>,
	);

describe("Toolbar engine", () => {
	it("accepts only disabled or one through sixty-four configured slots", () => {
		for (const toolbarSize of [
			undefined,
			0,
			1,
			64,
		]) {
			expect(() =>
				GameConfigSchema.parse({
					...configInput,
					meta: {
						...configInput.meta,
						toolbarSize,
					},
				}),
			).not.toThrow();
		}
		for (const toolbarSize of [
			-1,
			0.5,
			65,
			Number.POSITIVE_INFINITY,
		]) {
			expect(() =>
				GameConfigSchema.parse({
					...configInput,
					meta: {
						...configInput.meta,
						toolbarSize,
					},
				}),
			).toThrow();
		}
	});

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
				if (stored.kind !== "move") throw new Error("Expected toolbar move.");
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
			kind: "move",
			previousLocation: board(0, 0),
			location: toolbar(0),
		});
		expect(result.restored).toMatchObject({
			kind: "move",
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
			kind: "swap",
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
			kind: "reject",
			reason: "invalid-target",
			itemId: "runtime:board-only",
		});
		expect(result.runtime.items[0]?.location).toEqual(board(1, 0));
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
				return yield* planDropScopePlacementFx({
					drop: {
						itemId: "water",
						placement: "drop",
						quantity: 1,
					},
					item: config.items.water,
					origin: board(0, 0),
					quantity: 1,
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
					yield* fromRuntimeFx({
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
		const issues = Effect.runSync(
			checkRuntimeLocationsFx({
				config: disabledConfig,
				runtime,
			}),
		);

		expect(issues).toContainEqual({
			type: "location:out-of-bounds",
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
				const stored = yield* moveItemFx({
					itemId: owner.id,
					revision: owner.revision,
					location: toolbar(0),
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 5_000,
				});
				const paused = yield* readOwnerJobQueueFx({
					ownerItemId: owner.id,
				});
				yield* moveItemFx({
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

		expect(result.paused).toEqual([
			expect.objectContaining({
				status: "paused",
				job: expect.objectContaining({
					remainingMs: 600,
				}),
			}),
		]);
		expect(result.runtime.jobs).toEqual([]);
	});

	it("keeps toolbar contents global while the active Board space changes", () => {
		const result = run(
			Effect.gen(function* () {
				const stored = yield* spawnItemFx({
					id: "runtime:stored",
					itemId: "water",
					location: toolbar(0),
					quantity: 1,
				});
				yield* setCurrentSpaceFx({
					space: 7,
				});
				return {
					stored,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.runtime.currentSpace).toBe(7);
		expect(result.runtime.items[0]).toMatchObject({
			id: result.stored.id,
			location: toolbar(0),
		});
	});
});
