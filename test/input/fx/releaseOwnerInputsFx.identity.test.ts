import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { removeItemFx } from "~/v1/runtime/write/removeItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { StateSchema } from "~/v1/state/schema/StateSchema";

const baseItem = ({ id, maxStackSize = 1 }: { id: string; maxStackSize?: number }) => ({
	id,
	title: id,
	description: id,
	asset: {
		source: [
			`asset:${id}`,
		],
	},
	tags: [],
	categoryId: "test",
	scope: "any" as const,
	maxStackSize,
});

const materialInput = (itemId: string) => ({
	type: "materials" as const,
	selector: {
		type: "item" as const,
		itemId,
	},
	quantity: {
		type: "value" as const,
		value: 1,
	},
	capacity: 1,
	mode: "reserve" as const,
});

const config = GameConfigSchema.parse({
	version: "1.0",
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
		inventory: {
			width: 1,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	categories: {},
	items: {
		outer: {
			...baseItem({
				id: "outer",
			}),
			type: "producer",
			maxQueueSize: 1,
			lines: [
				{
					id: "line:outer",
					title: "Outer",
					description: "Outer",
					runtimeMs: 1_000,
					input: [
						materialInput("worker"),
						materialInput("worker"),
						{
							...materialInput("material"),
							capacity: 3,
							quantity: {
								type: "value",
								value: 3,
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
			type: "producer",
			charges: {
				amount: 2,
			},
			maxQueueSize: 1,
			lines: [
				{
					id: "line:worker",
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
			...baseItem({
				id: "payload",
			}),
			type: "simple",
		},
		material: {
			...baseItem({
				id: "material",
				maxStackSize: 10,
			}),
			type: "simple",
		},
		blocker: {
			...baseItem({
				id: "blocker",
			}),
			type: "simple",
		},
	},
});

const boardOwner = {
	id: "runtime:outer",
	itemId: "outer",
	location: {
		scope: "board" as const,
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	quantity: 1,
};

const inputItem = ({
	id,
	inputIndex,
	itemId,
	ownerItemId = boardOwner.id,
	remainingCharges,
}: {
	id: string;
	inputIndex: number;
	itemId: string;
	ownerItemId?: string;
	remainingCharges?: number;
}) => ({
	id,
	itemId,
	location: {
		scope: "input" as const,
		ownerItemId,
		lineId: ownerItemId === boardOwner.id ? "line:outer" : "line:worker",
		inputIndex,
	},
	quantity: 1,
	remainingCharges,
});

const runRemoveFx = (state: StateSchema.Type) =>
	Effect.gen(function* () {
		const before = yield* readRuntimeFx();
		const owner = before.items.find((item) => item.id === boardOwner.id);
		if (owner === undefined) {
			return yield* Effect.dieMessage("Expected outer owner.");
		}
		const attempt = yield* Effect.either(
			removeItemFx({
				itemId: owner.id,
				revision: owner.revision,
			}),
		);
		return {
			after: yield* readRuntimeFx(),
			attempt,
			before,
		};
	}).pipe(
		useGameFx({
			config,
			state,
		}),
	);

describe("releaseOwnerInputsFx existing identity", () => {
	it("preserves one impure buffered root and its passive subtree", () => {
		const state = {
			currentSpace: 0,
			items: [
				boardOwner,
				inputItem({
					id: "runtime:worker",
					inputIndex: 0,
					itemId: "worker",
					remainingCharges: 1,
				}),
				inputItem({
					id: "runtime:payload",
					inputIndex: 0,
					itemId: "payload",
					ownerItemId: "runtime:worker",
				}),
			],
			jobs: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(runRemoveFx(state));

		expect(Either.isRight(result.attempt)).toBe(true);
		const worker = result.after.items.find((item) => item.id === "runtime:worker");
		expect(worker).toMatchObject({
			remainingCharges: 1,
			location: {
				scope: "board",
				space: 0,
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
	});

	it("allows a pure buffered root to normalize into an existing stack", () => {
		const state = {
			currentSpace: 0,
			items: [
				boardOwner,
				{
					...inputItem({
						id: "runtime:buffered-material",
						inputIndex: 2,
						itemId: "material",
					}),
					quantity: 3,
				},
				{
					id: "runtime:material-stack",
					itemId: "material",
					location: {
						scope: "board" as const,
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 2,
				},
			],
			jobs: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(runRemoveFx(state));

		expect(Either.isRight(result.attempt)).toBe(true);
		expect(result.after.items.some((item) => item.id === "runtime:buffered-material")).toBe(
			false,
		);
		expect(
			result.after.items.find((item) => item.id === "runtime:material-stack"),
		).toMatchObject({
			quantity: 5,
		});
	});

	it("preserves impure identities across board-first inventory fallback", () => {
		const state = {
			currentSpace: 0,
			items: [
				boardOwner,
				inputItem({
					id: "runtime:worker:a",
					inputIndex: 0,
					itemId: "worker",
					remainingCharges: 1,
				}),
				inputItem({
					id: "runtime:worker:b",
					inputIndex: 1,
					itemId: "worker",
					remainingCharges: 1,
				}),
				{
					id: "runtime:blocker",
					itemId: "blocker",
					location: {
						scope: "board" as const,
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				},
			],
			jobs: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(runRemoveFx(state));

		expect(Either.isRight(result.attempt)).toBe(true);
		expect(result.after.items.find((item) => item.id === "runtime:worker:a")).toMatchObject({
			remainingCharges: 1,
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
		});
		expect(result.after.items.find((item) => item.id === "runtime:worker:b")).toMatchObject({
			remainingCharges: 1,
			location: {
				scope: "inventory",
				position: {
					x: 0,
					y: 0,
				},
			},
		});
	});

	it("rolls back the whole removal when one impure root has no exclusive cell", () => {
		const state = {
			currentSpace: 0,
			items: [
				boardOwner,
				inputItem({
					id: "runtime:worker:a",
					inputIndex: 0,
					itemId: "worker",
					remainingCharges: 1,
				}),
				inputItem({
					id: "runtime:worker:b",
					inputIndex: 1,
					itemId: "worker",
					remainingCharges: 1,
				}),
				{
					id: "runtime:board-blocker",
					itemId: "blocker",
					location: {
						scope: "board" as const,
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				},
				{
					id: "runtime:inventory-blocker",
					itemId: "blocker",
					location: {
						scope: "inventory" as const,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				},
			],
			jobs: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(runRemoveFx(state));

		expect(Either.isLeft(result.attempt)).toBe(true);
		if (Either.isLeft(result.attempt)) {
			expect(result.attempt.left).toMatchObject({
				_tag: "PlacementUnavailableError",
			});
		}
		expect(result.after).toEqual(result.before);
	});
});
