import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const baseItem = ({ id }: { id: string }) => ({
	uid: id,

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
			rules: [],
			roll: [
				{
					type: "guaranteed" as const,
					outcome: [
						{
							type: "item" as const,
							itemUid: itemId,
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

const emptyChanceOutput = (itemId: string) => ({
	set: [
		{
			rules: [],
			roll: [
				{
					type: "chance" as const,
					chance: 0,
					outcome: [
						{
							type: "item" as const,
							itemUid: itemId,
							quantity: {
								min: 1,
								max: 1,
							},
							placement: "drop" as const,
							rules: [],
						},
					],
				},
			],
		},
	],
});

const expiryLineFn = (
	uid: string,
	outcome: ReturnType<typeof guaranteedOutput> | ReturnType<typeof emptyChanceOutput>,
) => ({
	uid,
	title: "Expiry",
	description: "Expiry",
	clock: "clock-lifetime",
	runtimeMs: 0,
	input: [],
	outcome,
	rules: [],
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
		},
		start: {
			currentSpace: 0,
			spaces: [],
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
							itemUid: "blocker",
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

				lines: [
					expiryLineFn(
						"expiry:temporaryOutput",
						guaranteedOutput({
							itemId: "result",
						}),
					),
				],
				maxQueueSize: 1,
				clock: {
					durationMs: 600,
				},
			},
			temporaryEmptyOutput: {
				...baseItem({
					id: "temporaryEmptyOutput",
				}),

				lines: [
					expiryLineFn("expiry:temporaryEmptyOutput", emptyChanceOutput("result")),
				],
				maxQueueSize: 1,
				clock: {
					durationMs: 600,
				},
			},
			temporaryRandomOutput: {
				...baseItem({
					id: "temporaryRandomOutput",
				}),

				lines: [
					expiryLineFn(
						"expiry:temporaryRandomOutput",
						guaranteedOutput({
							itemId: "result",
							placement: "random",
							quantity: {
								min: 2,
								max: 3,
							},
						}),
					),
				],
				maxQueueSize: 1,
				clock: {
					durationMs: 600,
				},
			},
			temporaryCappedOutput: {
				...baseItem({
					id: "temporaryCappedOutput",
				}),

				lines: [
					expiryLineFn(
						"expiry:temporaryCappedOutput",
						guaranteedOutput({
							itemId: "cappedResult",
						}),
					),
				],
				maxQueueSize: 1,
				clock: {
					durationMs: 600,
				},
			},
			producer: {
				...baseItem({
					id: "producer",
				}),

				maxQueueSize: 1,
				lines: [
					{
						uid: "line:producer:temporary",
						title: "Temporary",
						description: "Produces one temporary item.",
						runtimeMs: 200,
						input: [
							{
								type: "simple",
							},
						],
						outcome: guaranteedOutput({
							itemId: "temporaryPlain",
						}),
						rules: [],
					},
				],
			},
		},
	});
