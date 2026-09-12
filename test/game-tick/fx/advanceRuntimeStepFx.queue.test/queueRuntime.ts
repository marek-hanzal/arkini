import { Effect } from "effect";

import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { JobQueueRequestSchema } from "~/production-job/schema/JobQueueRequestSchema";

const base = createJobTestConfig(4, "any");
const forge = base.items.forge;

export const queueConfig = GameConfigSchema.parse({
	...base,
	items: {
		...base.items,
		forge: {
			...forge,
			lines: [
				{
					id: "line:older",
					title: "Older",
					description: "Wait for two tools.",
					runtimeMs: 1_000,
					input: [
						{
							type: "materials",
							selector: {
								type: "item",
								itemId: "tool",
							},
							quantity: {
								min: 2,
								max: 2,
							},
							capacity: 2,
							mode: "consume",
						},
					],
					rules: [],
				},
				{
					id: "line:later",
					title: "Later",
					description: "Run without materials.",
					runtimeMs: 1_000,
					input: [
						{
							type: "simple",
						},
					],
					rules: [],
				},
				{
					id: "line:water",
					title: "Water",
					description: "Compete for the shared water.",
					runtimeMs: 1_000,
					input: [
						{
							type: "materials",
							selector: {
								type: "item",
								itemId: "water",
							},
							quantity: {
								min: 1,
								max: 1,
							},
							capacity: 1,
							mode: "consume",
						},
					],
					rules: [],
				},
			],
		},
	},
});

export const createContendedQueueConfigFn = (budget: "units" | "output") => {
	const producer = queueConfig.items.forge;
	return GameConfigSchema.parse({
		...queueConfig,
		items: {
			...queueConfig.items,
			payer: {
				...queueConfig.items.water,
				id: "payer",
				uid: "payer",
				units: {
					amount: 3,
				},
			},
			result: {
				...queueConfig.items.water,
				id: "result",
				uid: "result",
				maxCount: 1,
			},
			forge: {
				...producer,
				lines: producer.lines.map((line) =>
					line.id !== "line:later"
						? line
						: {
								...line,
								...(budget === "units"
									? {
											input: [
												{
													type: "units",
													query: {
														scope: "board",
														selector: {
															type: "item",
															itemId: "payer",
														},
														distance: "close",
													},
													units: {
														from: "target",
														cost: 2,
													},
												},
											],
										}
									: {
											output: {
												set: [
													{
														roll: [
															{
																type: "guaranteed",
																drop: [
																	{
																		itemId: "result",
																		quantity: {
																			min: 1,
																			max: 1,
																		},
																		placement: "drop",
																		rules: [],
																	},
																],
															},
														],
													},
												],
											},
										}),
							},
				),
			},
		},
	});
};

export const requestFn = (
	id: string,
	lineId: string,
	ownerItemId = "owner:a",
): JobQueueRequestSchema.Type => ({
	id,
	ownerItemId,
	lineId,
});

export const itemFn = (
	id: string,
	itemId: string,
	location: RuntimeItemSchema.Type["location"],
	quantity = 1,
): RuntimeItemSchema.Type => ({
	id,
	item: queueConfig.items[itemId]!,
	location,
	quantity,
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

export const bufferFn = (quantity: number) =>
	itemFn(
		"buffer:older",
		"tool",
		{
			scope: "input",
			ownerItemId: "owner:a",
			lineId: "line:older",
			inputIndex: 0,
		},
		quantity,
	);

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
