import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { dropItemFx } from "~/engine/runtime/write/dropItemFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";

const config = GameConfigSchema.parse({
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

const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config,
			}),
		) as Effect.Effect<A, E, never>,
	);

describe("dropItemFx", () => {
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
			kind: "move",
			itemId: "runtime:water",
			previousLocation: sourceLocation,
			location: emptyLocation,
		});
		expect(result.runtime.items[0]?.location).toEqual(emptyLocation);
	});

	it("rejects an occupied destination without mutating either item", () => {
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
					},
				});
				const runtime = yield* readRuntimeFx();
				return {
					outcome,
					runtime,
					source,
					target,
				};
			}),
		);

		expect(result.outcome).toEqual({
			kind: "reject",
			reason: "occupied",
			itemId: "runtime:water",
			targetItemId: "runtime:stone",
		});
		expect(result.runtime.items).toEqual([
			result.source,
			result.target,
		]);
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
			kind: "ignored",
			reason: "same-location",
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
			kind: "reject",
			reason: "stale-source",
			itemId: "runtime:water",
		});
		expect(result.runtime.items).toEqual([
			result.source,
		]);
	});
});
