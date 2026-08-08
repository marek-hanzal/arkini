import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

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
		version: "1.0",
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
				...baseItem({
					id: "transformer",
				}),
				type: "simple",
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
				...baseItem({
					id: "blocker",
				}),
				type: "simple",
			},
			result: {
				...baseItem({
					id: "result",
				}),
				type: "simple",
			},
			cappedResult: {
				...baseItem({
					id: "cappedResult",
					maxCount: 1,
				}),
				type: "simple",
			},
			temporaryPlain: {
				...baseItem({
					id: "temporaryPlain",
				}),
				type: "temporary",
				durationMs: 600,
			},
			temporaryOutput: {
				...baseItem({
					id: "temporaryOutput",
				}),
				type: "temporary",
				durationMs: 600,
				output: guaranteedOutput({
					itemId: "result",
				}),
			},
			temporaryRandomOutput: {
				...baseItem({
					id: "temporaryRandomOutput",
				}),
				type: "temporary",
				durationMs: 600,
				output: guaranteedOutput({
					itemId: "result",
					placement: "random",
					quantity: {
						min: 2,
						max: 3,
					},
				}),
			},
			temporaryCappedOutput: {
				...baseItem({
					id: "temporaryCappedOutput",
				}),
				type: "temporary",
				durationMs: 600,
				output: guaranteedOutput({
					itemId: "cappedResult",
				}),
			},
			producer: {
				...baseItem({
					id: "producer",
				}),
				type: "producer",
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
