import { Effect } from "effect";

import { storeInputMaterialFx } from "~/v1/input/write/storeInputMaterialFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";

const baseItem = ({ id, scope }: { id: string; scope: "any" | "board" }) => ({
	id,
	title: id,
	description: id,
	asset: {
		source: [
			`asset:${id}`,
		],
	},
	tags: [],
	categoryId: "resource",
	scope,
	maxStackSize: 10,
});

export const createJobTestConfig = (
	maxQueueSize = 2,
	forgeScope: "board" | "any" = "board",
	runtimeMs = 1_000,
) =>
	GameConfigSchema.parse({
		version: "1.0",
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
			inventory: {
				width: 3,
				height: 1,
			},
		},
		start: {},
		categories: {},
		items: {
			forge: {
				...baseItem({
					id: "forge",
					scope: forgeScope,
				}),
				type: "producer",
				afterCompletion: "keep",
				maxStackSize: 1,
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
								selector: {
									type: "item",
									itemId: "water",
								},
								quantity: {
									type: "value",
									value: 3,
								},
								capacity: 3,
								mode: "consume",
							},
							{
								type: "materials",
								selector: {
									type: "item",
									itemId: "tool",
								},
								quantity: {
									type: "value",
									value: 1,
								},
								capacity: 1,
								mode: "reserve",
							},
						],
						rules: [],
					},
				],
			},
			water: {
				...baseItem({
					id: "water",
					scope: "any",
				}),
				type: "simple",
			},
			tool: {
				...baseItem({
					id: "tool",
					scope: "any",
				}),
				type: "simple",
			},
		},
	});

export const prepareJobLineFx = Effect.fn("prepareJobLineFx")(function* () {
	const owner = yield* spawnItemFx({
		id: "runtime:forge",
		itemId: "forge",
		location: {
			scope: "board",
			position: {
				x: 0,
				y: 0,
			},
		},
		quantity: 1,
	});
	const water = yield* spawnItemFx({
		id: "runtime:water",
		itemId: "water",
		location: {
			scope: "board",
			position: {
				x: 1,
				y: 0,
			},
		},
		quantity: 6,
	});
	const tool = yield* spawnItemFx({
		id: "runtime:tool",
		itemId: "tool",
		location: {
			scope: "board",
			position: {
				x: 2,
				y: 0,
			},
		},
		quantity: 2,
	});
	yield* storeInputMaterialFx({
		ownerItemId: owner.id,
		lineId: "line:forge:run",
		inputIndex: 0,
		sourceItemId: water.id,
		sourceItemRevision: water.revision,
		quantity: 6,
	});
	yield* storeInputMaterialFx({
		ownerItemId: owner.id,
		lineId: "line:forge:run",
		inputIndex: 1,
		sourceItemId: tool.id,
		sourceItemRevision: tool.revision,
		quantity: 2,
	});

	return owner;
});
