import { Effect } from "effect";
import { expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
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
						itemUid: "portal",
					},
					action: "consume",
					effect: "keep",
				},
			],
		},
		portal: {
			...configInput.items.stone,
			uid: "portal",
			title: "Portal",
			description: "Portal",
			lines: [
				{
					uid: "travel",
					title: "Travel",
					description: "Travel",
					default: true,
					runtimeMs: 0,
					input: [
						{
							type: "simple",
						},
					],
					rules: [],
					outcome: {
						set: [
							{
								weight: 1,
								rules: [],
								roll: [
									{
										type: "guaranteed",
										outcome: [
											{
												type: "space",
												space: 7,
												rules: [],
											},
										],
									},
								],
							},
						],
					},
				},
			],
			merge: [
				{
					target: {
						type: "item",
						itemUid: "stone",
					},
					action: "consume",
					effect: "keep",
				},
			],
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

// A destination outcome must not hijack the occupied target's ordinary drop semantics.
it.each([
	{
		itemId: "water",
		kind: DropItemResultKind.Merge,
	},
	{
		itemId: "stone",
		kind: DropItemResultKind.Swap,
	},
])(
	"uses ordinary $kind when dropping $itemId onto a Space-producing owner",
	async ({ itemId, kind }) => {
		const result = await run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "source",
					itemUid: itemId,
					location: board(0, 0, 0),
				});
				const target = yield* spawnItemFx({
					id: "destination",
					itemUid: "portal",
					location: board(1, 0, 0),
				});
				const outcome = yield* dropOntoFx({
					sourceId: source.id,
					targetId: target.id,
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
			portalConfig,
		);
		expect(result.outcome.kind).toBe(kind);
		expect(result.runtime.currentSpace).toBe(0);
		expect(
			result.runtime.items.every(
				(item) => item.location.scope !== "board" || item.location.space === 0,
			),
		).toBe(true);
	},
);
