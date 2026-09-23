import { Effect } from "effect";

import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const baseItem = ({ id }: { id: string }) => ({
	uid: id,
	id,
	title: id,
	description: id,
	ui: "default" as const,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${id}`,
		],
	},
});

export const createJobTestConfig = (maxQueueSize = 2, runtimeMs = 1_000) =>
	GameConfigSchema.parse({
		resources: {
			hero: "hero",
		},
		meta: {
			id: `game:job:${maxQueueSize}`,
			title: "Job test",
			board: {
				width: 5,
				height: 2,
			},
		},
		start: {
			currentSpace: 0,
			spaces: [],
		},
		items: {
			forge: {
				...baseItem({
					id: "forge",
				}),

				maxQueueSize,
				lines: [
					{
						id: "line:forge:run",
						title: "Run",
						description: "Run the forge.",
						runtimeMs,
						input: [
							{
								type: "materials",
								query: {
									distance: "far" as const,
									selector: {
										type: "item",
										itemId: "water",
									},
								},
								quantity: {
									min: 3,
									max: 3,
								},
								mode: "consume",
							},
							{
								type: "materials",
								query: {
									distance: "far" as const,
									selector: {
										type: "item",
										itemId: "tool",
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
			water: {
				maxQueueSize: 1,
				lines: [],

				...baseItem({
					id: "water",
				}),
			},
			tool: {
				maxQueueSize: 1,
				lines: [],

				...baseItem({
					id: "tool",
				}),
			},
		},
	});

export const prepareJobLineFx = Effect.fn("prepareJobLineFx")(function* () {
	const owner = yield* spawnItemFx({
		id: "runtime:forge",
		itemId: "forge",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		},
	});
	for (let index = 0; index < 6; index += 1) {
		const water = yield* spawnItemFx({
			id: index === 0 ? "runtime:water" : `runtime:water:${index}`,
			itemId: "water",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1 + (index % 3),
					y: Math.floor(index / 3),
				},
			},
		});
		if (index < 3)
			yield* storeInputMaterialFx({
				ownerItemId: owner.id,
				lineId: "line:forge:run",
				inputIndex: 0,
				sourceItemId: water.id,
				sourceItemRevision: water.revision,
			});
	}
	for (let index = 0; index < 2; index += 1) {
		const tool = yield* spawnItemFx({
			id: index === 0 ? "runtime:tool" : `runtime:tool:${index}`,
			itemId: "tool",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 2,
					y: 0,
				},
			},
		});
		if (index === 0)
			yield* storeInputMaterialFx({
				ownerItemId: owner.id,
				lineId: "line:forge:run",
				inputIndex: 1,
				sourceItemId: tool.id,
				sourceItemRevision: tool.revision,
			});
	}

	return owner;
});
