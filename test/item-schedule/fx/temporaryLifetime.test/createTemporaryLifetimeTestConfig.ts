import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const baseItem = ({
	id,
	maxStackSize = 1,
	maxCount,
}: {
	id: string;
	maxStackSize?: number;
	maxCount?: number;
}) => ({
	uid: id,
	id,
	title: id,
	description: id,
	asset: {
		scale: 0.8,
		default: [
			`asset:${id}`,
		],
	},
	scope: "board" as const,
	maxStackSize,
	maxCount,
});

const guaranteedOutput = ({
	itemId,
	placement = "drop",
	quantity = {
		min: 1,
		max: 1,
	},
}: {
	itemId: string;
	placement?: "drop" | "random";
	quantity?: {
		min: number;
		max: number;
	};
}) => ({
	set: [
		{
			roll: [
				{
					type: "guaranteed" as const,
					drop: [
						{
							itemId,
							quantity,
							placement,
							rules: [],
						},
					],
				},
			],
		},
	],
});

export const createTemporaryLifetimeTestConfig = () =>
	GameConfigSchema.parse({
		resources: {
			hero: "hero",
		},
		meta: {
			id: "game:temporary-lifetime",
			title: "Temporary lifetime test",
			board: {
				width: 4,
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
		items: {
			transformer: {
				maxQueueSize: 1,
				lines: [],

				...baseItem({
					id: "transformer",
				}),

				merge: [
					{
						target: {
							type: "item",
							itemId: "blocker",
						},
						action: "consume",
						effect: "replace",
						result: "temporaryPlain",
					},
				],
			},
			blocker: {
				maxQueueSize: 1,
				lines: [],

				...baseItem({
					id: "blocker",
				}),
			},
			result: {
				maxQueueSize: 1,
				lines: [],

				...baseItem({
					id: "result",
				}),
			},
			cappedResult: {
				maxQueueSize: 1,
				lines: [],

				...baseItem({
					id: "cappedResult",
					maxCount: 1,
				}),
			},
			temporaryPlain: {
				...baseItem({
					id: "temporaryPlain",
				}),

				lines: [],
				maxQueueSize: 1,
				clock: {
					durationMs: 600,
				},
			},
			temporaryOutput: {
				...baseItem({
					id: "temporaryOutput",
				}),

				lines: [],
				maxQueueSize: 1,
				clock: {
					durationMs: 600,
					onExpire: guaranteedOutput({
						itemId: "result",
					}),
				},
			},
			temporaryRandomOutput: {
				...baseItem({
					id: "temporaryRandomOutput",
				}),

				lines: [],
				maxQueueSize: 1,
				clock: {
					durationMs: 600,
					onExpire: guaranteedOutput({
						itemId: "result",
						placement: "random",
						quantity: {
							min: 2,
							max: 3,
						},
					}),
				},
			},
			temporaryCappedOutput: {
				...baseItem({
					id: "temporaryCappedOutput",
				}),

				lines: [],
				maxQueueSize: 1,
				clock: {
					durationMs: 600,
					onExpire: guaranteedOutput({
						itemId: "cappedResult",
					}),
				},
			},
			producer: {
				...baseItem({
					id: "producer",
				}),

				maxQueueSize: 1,
				lines: [
					{
						id: "line:producer:temporary",
						title: "Temporary",
						description: "Produces one temporary item.",
						runtimeMs: 200,
						input: [
							{
								type: "simple",
							},
						],
						output: guaranteedOutput({
							itemId: "temporaryPlain",
						}),
						rules: [],
					},
				],
			},
		},
	});
