import { Effect } from "effect";

import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { JobQueueRequestSchema } from "~/production-job/schema/JobQueueRequestSchema";

const base = createJobTestConfig(4);
const forge = base.items.forge;

export const queueConfig = GameConfigSchema.parse({
	...base,
	items: {
		...base.items,
		forge: {
			...forge,
			lines: [
				{
					uid: "line:older",
					title: "Older",
					description: "Wait for two tools.",
					runtimeMs: 1_000,
					input: [
						{
							type: "materials",
							query: {
								distance: "far",
								selector: {
									type: "item",
									itemUid: "tool",
								},
							},
							quantity: {
								min: 2,
								max: 2,
							},
							mode: "consume",
						},
					],
					rules: [],
				},
				{
					uid: "line:later",
					title: "Later",
					description: "Run without materials.",
					runtimeMs: 1_000,
					input: [],
					rules: [],
				},
				{
					uid: "line:water",
					title: "Water",
					description: "Compete for the shared water.",
					runtimeMs: 1_000,
					input: [
						{
							type: "materials",
							query: {
								distance: "far",
								selector: {
									type: "item",
									itemUid: "water",
								},
							},
							quantity: {
								min: 1,
								max: 1,
							},
							mode: "consume",
						},
					],
					rules: [],
				},
			],
		},
	},
});

export const createContendedQueueConfigFn = () => {
	const producer = queueConfig.items.forge;
	return GameConfigSchema.parse({
		...queueConfig,
		items: {
			...queueConfig.items,
			payer: {
				...queueConfig.items.water,
				uid: "payer",
				units: {
					amount: 3,
				},
			},
			forge: {
				...producer,
				lines: producer.lines.map((line) =>
					line.uid !== "line:later"
						? line
						: {
								...line,
								input: [
									{
										type: "units",
										query: {
											selector: {
												type: "item",
												itemUid: "payer",
											},
											distance: "close",
										},
										units: {
											from: "target",
											cost: 2,
										},
									},
								],
							},
				),
			},
		},
	});
};

export const requestFn = (
	id: string,
	lineUid: string,
	ownerItemId = "owner:a",
): JobQueueRequestSchema.Type => ({
	id,
	ownerItemId,
	lineUid,
});

export const itemFn = (
	id: string,
	itemId: string,
	location: RuntimeItemSchema.Type["location"],
): RuntimeItemSchema.Type => ({
	id,
	item: queueConfig.items[itemId]!,
	location,

	revision: `revision:${id}`,
});

export const boardFn = (x: number): RuntimeItemSchema.Type["location"] => ({
	scope: "board",
	space: 0,
	position: {
		x,
		y: 0,
	},
});

export const bufferFn = (id = "buffer:older") =>
	itemFn(id, "tool", {
		scope: "input",
		ownerItemId: "owner:a",
		lineUid: "line:older",
		inputIndex: 0,
	});

// Explicit snapshots exercise immutable Tick drafts; start/projection operations pin their reads
// to the supplied Runtime instead of the otherwise empty Runtime service provided by useGameFx.
export const prepareQueueFx = Effect.fn("prepareQueueFx")(function* (
	jobQueue: JobQueueRequestSchema.Type[],
	items: RuntimeItemSchema.Type[] = [],
) {
	return {
		...(yield* readRuntimeFx()),
		items: [
			itemFn("owner:a", "forge", boardFn(0)),
			...items,
		],
		jobQueue,
	};
});
