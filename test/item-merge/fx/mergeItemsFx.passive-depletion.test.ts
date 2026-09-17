import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createMergeTestConfig } from "~test/item-merge/support/createMergeTestConfig";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { StateSchema } from "~/game-persistence/schema/StateSchema";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { storeInventoryItemFx } from "~/item-interaction/fx/storeInventoryItemFx";

const board = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});
const runDepletion = (scope: "board" | "inventory" | "toolbar", blockReturn = false) => {
	const base = createMergeTestConfig({
		board: {
			width: 2,
			height: 1,
		},
		sourceUnits: {
			amount: 1,
		},
		rule: {
			target: {
				type: "item",
				itemId: "target",
			},
			action: "spend",
			effect: "keep",
		},
	});
	const config = GameConfigSchema.parse({
		...base,
		meta: {
			...base.meta,
			toolbarSize: 2,
		},
		items: {
			...base.items,
			output: {
				...base.items.output,
				scope: blockReturn ? "board" : "any",
			},
			source: {
				...base.items.source,
				lines: [
					{
						id: "line",
						title: "Line",
						description: "Buffered material",
						runtimeMs: 1000,
						input: [
							{
								type: "materials",
								selector: {
									type: "item",
									itemId: "output",
								},
								quantity: {
									min: 1,
									max: 1,
								},
								mode: "reserve",
							},
						],
						rules: [],
					},
				],
			},
		},
	});
	const state = StateSchema.parse({
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
		currentSpace: 0,
		items: [
			{
				id: "source",
				itemId: "source",
				quantity: 1,
				location: board(0),
			},
			{
				id: "target",
				itemId: "target",
				quantity: 1,
				location: board(1),
			},
			{
				id: "material",
				itemId: "output",
				quantity: 1,
				location: {
					scope: "input",
					ownerItemId: "source",
					lineId: "line",
					inputIndex: 0,
				},
			},
		],
		jobs: [],
		jobQueue: [],
	});
	return Effect.runSync(
		Effect.gen(function* () {
			const initial = yield* readRuntimeFx();
			const source = initial.items.find((item) => item.id === "source")!;
			if (scope === "inventory") {
				const stored = yield* storeInventoryItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: board(0),
				});
				expect(stored.kind).toBe("store-inventory");
			}
			if (scope === "toolbar") {
				const moved = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: board(0),
					target: {
						kind: "slot",
						location: {
							scope: "toolbar",
							position: {
								x: 0,
								y: 0,
							},
						},
						occupant: null,
					},
				});
				expect(moved.kind).toBe("move");
			}
			if (blockReturn)
				yield* spawnItemFx({
					id: "blocker",
					itemId: "blocker",
					quantity: 1,
					location: board(0),
				});
			const transitions = yield* CommittedTransitionsFx;
			const before = yield* transitions.read;
			const current = before.runtime.items.find((item) => item.id === "source")!;
			const target = before.runtime.items.find((item) => item.id === "target")!;
			if (
				current.location.scope !== "board" &&
				current.location.scope !== "inventory" &&
				current.location.scope !== "toolbar"
			)
				throw new Error("Expected a grid source.");
			const drop = yield* dropItemFx({
				sourceItemId: current.id,
				sourceRevision: current.revision,
				sourceLocation: current.location,
				target: {
					kind: "slot",
					location: board(1),
					occupant: {
						itemId: target.id,
						revision: target.revision,
					},
				},
			});
			return {
				before,
				after: yield* transitions.read,
				drop,
			};
		}).pipe(
			useGameFx({
				config,
				state,
			}),
		),
	);
};

describe("merge source depletion with buffered material", () => {
	it.each([
		"board",
		"inventory",
		"toolbar",
	] as const)("returns buffered material from the source's physical %s origin", (scope) => {
		const { after, drop } = runDepletion(scope);
		expect(drop.kind).toBe("merge");
		expect(after.runtime.items).toHaveLength(2);
		expect(after.runtime.items.find((item) => item.id === "source")).toBeUndefined();
		expect(after.runtime.items.find((item) => item.item.id === "output")).toMatchObject({
			quantity: 1,
			location: {
				scope,
				position: {
					x: 0,
					y: 0,
				},
			},
		});
		expect(after.events).toContainEqual(
			expect.objectContaining({
				type: "item:depleted",
				itemId: "source",
				resultingQuantity: 0,
			}),
		);
	});
	it("rolls back passive-source depletion when the buffered material's required scope is full", () => {
		const { before, after, drop } = runDepletion("inventory", true);
		expect(drop).toMatchObject({
			kind: "reject",
			reason: "blocked",
		});
		expect(after).toBe(before);
	});
});
