import { Effect } from "effect";
import { expect, it } from "vitest";

import { createMergeTestConfig } from "~test/item-merge/support/createMergeTestConfig";
import { useGameFx } from "~test/support/useGameFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { StateSchema } from "~/game-persistence/schema/StateSchema";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";

const board = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});
const runDepletion = (blockReturn = false) => {
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
		},
		items: {
			...base.items,
			output: {
				...base.items.output,
				maxStackSize: 1,
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
								query: {
									distance: "far" as const,
									selector: {
										type: "item",
										itemId: "output",
									},
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
	if (blockReturn) {
		const line = config.items.source.lines[0]!;
		line.input.push({
			...line.input[0]!,
		});
	}
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
	if (blockReturn)
		state.items.push({
			id: "material:second",
			itemId: "output",
			quantity: 1,
			location: {
				scope: "input",
				ownerItemId: "source",
				lineId: "line",
				inputIndex: 1,
			},
		});
	return Effect.runSync(
		Effect.gen(function* () {
			const transitions = yield* CommittedTransitionsFx;
			const before = yield* transitions.read;
			const current = before.runtime.items.find((item) => item.id === "source")!;
			const target = before.runtime.items.find((item) => item.id === "target")!;
			if (current.location.scope !== "board") throw new Error("Expected a grid source.");
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

it.each([
	"board",
] as const)("returns buffered material from the source's physical %s origin", () => {
	const { after, drop } = runDepletion();
	expect(drop.kind).toBe("merge");
	expect(after.runtime.items).toHaveLength(2);
	expect(after.runtime.items.find((item) => item.id === "source")).toBeUndefined();
	expect(after.runtime.items.find((item) => item.item.id === "output")).toMatchObject({
		quantity: 1,
		location: {
			scope: "board",
			space: 0,
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
it("rolls back source depletion when its two buffered items cannot fit on the Board", () => {
	const { before, after, drop } = runDepletion(true);
	expect(drop).toMatchObject({
		kind: "reject",
		reason: "blocked",
	});
	expect(after).toBe(before);
});
