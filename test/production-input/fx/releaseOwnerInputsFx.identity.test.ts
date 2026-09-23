import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { useGameFx } from "~test/support/useGameFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { RuntimeStoreFx } from "~/game-runtime/context/RuntimeStoreFx";
import { removeRuntimeItemForTestFx } from "~test/item-interaction/support/removeRuntimeItemForTestFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";

const baseItem = ({ id }: { id: string }) => ({
	uid: id,

	title: id,
	description: id,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${id}`,
		],
	},
});

const materialInput = (itemId: string) => ({
	type: "materials" as const,
	query: {
		distance: "far" as const,
		selector: {
			type: "item" as const,
			itemUid: itemId,
		},
	},
	quantity: {
		min: 1,
		max: 1,
	},
	mode: "reserve" as const,
});

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:release-owner-inputs",
		title: "Release owner inputs",
		board: {
			width: 2,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
		spaces: [],
	},
	items: {
		outer: {
			...baseItem({
				id: "outer",
			}),

			maxQueueSize: 1,
			lines: [
				{
					uid: "line:outer",
					title: "Outer",
					description: "Outer",
					runtimeMs: 1_000,
					input: [
						materialInput("worker"),
						materialInput("worker"),
						{
							...materialInput("material"),
							quantity: {
								min: 3,
								max: 3,
							},
						},
					],
					rules: [],
				},
			],
		},
		worker: {
			...baseItem({
				id: "worker",
			}),

			units: {
				amount: 2,
			},
			maxQueueSize: 1,
			lines: [
				{
					uid: "line:worker",
					title: "Worker",
					description: "Worker",
					runtimeMs: 1_000,
					input: [
						materialInput("payload"),
					],
					rules: [],
				},
			],
		},
		payload: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "payload",
			}),
		},
		material: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "material",
			}),
		},
		blocker: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "blocker",
			}),
		},
	},
});

const boardOwner = {
	id: "runtime:outer",
	itemUid: "outer",
	location: {
		scope: "board" as const,
		space: 2,
		position: {
			x: 0,
			y: 0,
		},
	},
};

const inputItem = ({
	id,
	inputIndex,
	itemUid,
	ownerItemId = boardOwner.id,
	remainingUnits,
}: {
	id: string;
	inputIndex: number;
	itemUid: string;
	ownerItemId?: string;
	remainingUnits?: number;
}) => ({
	id,
	itemUid,
	location: {
		scope: "input" as const,
		ownerItemId,
		lineUid: ownerItemId === boardOwner.id ? "line:outer" : "line:worker",
		inputIndex,
	},

	remainingUnits,
});

const runRemoveFx = (state: StateSchema.Type) =>
	Effect.gen(function* () {
		const before = yield* readRuntimeFx();
		const owner = before.items.find((item) => item.id === boardOwner.id);
		if (owner === undefined) {
			return yield* Effect.die(new Error("Expected outer owner."));
		}
		const attempt = yield* Effect.result(
			removeRuntimeItemForTestFx({
				itemId: owner.id,
				revision: owner.revision,
			}),
		);
		const store = yield* RuntimeStoreFx;
		const transition = yield* store.read;
		return {
			after: transition.runtime,
			attempt,
			before,
			events: transition.events,
		};
	}).pipe(
		useGameFx({
			config,
			state,
		}),
	);

describe("releaseOwnerInputsFx existing identity", () => {
	it("preserves a buffered identity beside an existing same-definition identity", () => {
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				speedUpGameplay: false,
			},
			currentSpace: 0,
			templateUidBySpace: {},
			items: [
				boardOwner,
				{
					...inputItem({
						id: "runtime:buffered-material",
						inputIndex: 2,
						itemUid: "material",
					}),
				},
				{
					id: "runtime:material:existing",
					itemUid: "material",
					location: {
						scope: "board" as const,
						space: 2,
						position: {
							x: 1,
							y: 0,
						},
					},
				},
			],
			jobQueue: [],
			jobs: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(runRemoveFx(state));

		expect(Result.isSuccess(result.attempt)).toBe(true);
		expect(result.after.items).toHaveLength(2);
		expect(
			result.after.items.find((item) => item.id === "runtime:buffered-material")?.location,
		).toEqual(boardOwner.location);
		expect(
			result.after.items.find((item) => item.id === "runtime:material:existing")?.location,
		).toEqual({
			scope: "board",
			space: 2,
			position: {
				x: 1,
				y: 0,
			},
		});
		expect(result.events).toContainEqual(
			expect.objectContaining({
				type: GameEventEnumSchema.enum.ItemPlaced,
				itemId: "runtime:buffered-material",
			}),
		);
	});
});

it("preserves one impure buffered root and its passive subtree", () => {
	const state = {
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
		currentSpace: 0,
		templateUidBySpace: {},
		items: [
			boardOwner,
			inputItem({
				id: "runtime:worker",
				inputIndex: 0,
				itemUid: "worker",
				remainingUnits: 1,
			}),
			inputItem({
				id: "runtime:payload",
				inputIndex: 0,
				itemUid: "payload",
				ownerItemId: "runtime:worker",
			}),
		],
		jobQueue: [],
		jobs: [],
	} satisfies StateSchema.Type;
	const result = Effect.runSync(runRemoveFx(state));

	expect(Result.isSuccess(result.attempt)).toBe(true);
	const worker = result.after.items.find((item) => item.id === "runtime:worker");
	expect(worker).toMatchObject({
		remainingUnits: 1,
		location: {
			scope: "board",
			space: 2,
			position: {
				x: 0,
				y: 0,
			},
		},
	});
	expect(result.after.items.find((item) => item.id === "runtime:payload")).toMatchObject({
		location: {
			scope: "input",
			ownerItemId: "runtime:worker",
		},
	});
	expect(result.events).toEqual([
		{
			type: GameEventEnumSchema.enum.ItemDisappeared,
			itemId: boardOwner.id,
			itemUid: boardOwner.itemUid,
			location: boardOwner.location,
		},
		{
			type: GameEventEnumSchema.enum.ItemPlaced,
			itemId: "runtime:worker",
			itemUid: "worker",
			originItemId: boardOwner.id,
			previousLocation: {
				scope: "input",
				ownerItemId: boardOwner.id,
				lineUid: "line:outer",
				inputIndex: 0,
			},
			location: {
				scope: "board",
				space: 2,
				position: {
					x: 0,
					y: 0,
				},
			},
		},
		{
			type: GameEventEnumSchema.enum.ItemRemoved,
			snapshot: result.before.items.find((item) => item.id === boardOwner.id),
		},
	]);
});

it("rolls back the whole removal when one impure root has no exclusive cell", () => {
	const state = {
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
		currentSpace: 0,
		templateUidBySpace: {},
		items: [
			boardOwner,
			inputItem({
				id: "runtime:worker:a",
				inputIndex: 0,
				itemUid: "worker",
				remainingUnits: 1,
			}),
			inputItem({
				id: "runtime:worker:b",
				inputIndex: 1,
				itemUid: "worker",
				remainingUnits: 1,
			}),
			{
				id: "runtime:board-blocker",
				itemUid: "blocker",
				location: {
					scope: "board" as const,
					space: 2,
					position: {
						x: 1,
						y: 0,
					},
				},
			},
			{
				id: "runtime:other-space-blocker",
				itemUid: "blocker",
				location: {
					scope: "board" as const,
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
			},
		],
		jobQueue: [],
		jobs: [],
	} satisfies StateSchema.Type;
	const result = Effect.runSync(runRemoveFx(state));

	expect(Result.isFailure(result.attempt)).toBe(true);
	if (Result.isFailure(result.attempt)) {
		expect(result.attempt.failure).toMatchObject({
			_tag: "PlacementUnavailableError",
		});
	}
	expect(result.after).toEqual(result.before);
	expect(result.events).toEqual([]);
});
