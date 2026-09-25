import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createTemporaryLifetimeTestConfig } from "~test/item-schedule/fx/temporaryLifetime.test/createTemporaryLifetimeTestConfig";

export type OutputPath = "expiry" | "line" | "deferred-depletion" | "immediate-depletion";

const outcome = (itemId: string, conditional = false) => ({
	set: [
		{
			weight: 1,
			rules: [],
			roll: [
				{
					type: "guaranteed",
					outcome: [
						{
							type: "item" as const,
							itemUid: itemId,
							quantity: {
								min: 1,
								max: 1,
							},
							placement: "drop",
							rules: conditional
								? [
										{
											type: "enable",
											when: [
												{
													type: "exists",
													query: {
														distance: "far",
														selector: {
															type: "item",
															itemUid: "blocker",
														},
													},
												},
											],
										},
									]
								: [],
						},
					],
				},
			],
		},
	],
});

export const createConfig = (path: OutputPath, markerDuration = 500) => {
	const base = createTemporaryLifetimeTestConfig();
	const producer = base.items.producer;
	const line = producer.lines[0];
	return GameConfigSchema.parse({
		...base,
		templates: [
			{
				uid: "start",
				title: "Start",
				...base.meta.board,
				board: [],
			},
		],
		start: {
			currentSpace: 0,
			spaces: [
				{
					space: 0,
					templateUid: "start",
				},
			],
		},
		items: {
			...base.items,
			temporaryPlain: {
				...base.items.temporaryPlain,
				lines: [
					{
						uid: "expiry:temporaryPlain",
						title: "Expiry",
						description: "Expiry",
						trigger: "item-termination",
						runtimeMs: 0,
						input: [],
						outcome: outcome("blocker"),
						rules: [],
					},
				],
				clock: {
					durationMs: markerDuration,
				},
			},
			temporaryOutput: {
				...base.items.temporaryOutput,
				lines: [
					{
						uid: "expiry:temporaryOutput",
						title: "Expiry",
						description: "Expiry",
						trigger: "item-termination",
						runtimeMs: 0,
						input: [],
						outcome: outcome("result", true),
						rules: [],
					},
				],
				clock: {
					durationMs: 600,
				},
			},
			payer: {
				...base.items.blocker,
				uid: "payer",
				lines: [
					{
						uid: "payer:termination",
						title: "Payer termination",
						trigger: "item-termination",
						runtimeMs: 0,
						input: [],
						outcome: outcome("result", true),
						rules: [],
					},
				],
				units: {
					amount: 1,
				},
			},
			producer: {
				...producer,
				maxQueueSize: 2,
				units:
					path === "deferred-depletion"
						? {
								amount: 1,
							}
						: undefined,
				lines: [
					...(path === "deferred-depletion"
						? [
								{
									uid: "producer:termination",
									title: "Producer termination",
									trigger: "item-termination" as const,
									runtimeMs: 0,
									input: [],
									outcome: outcome("result", true),
									rules: [],
								},
							]
						: []),
					{
						...line,
						runtimeMs: 600,
						input: [
							{
								type: "simple",
								units:
									path === "deferred-depletion"
										? {
												from: "self",
												cost: 1,
											}
										: undefined,
							},
						],
						outcome: path === "line" ? outcome("result", true) : undefined,
					},
					{
						...line,
						uid: "spend",
						outcome: undefined,
						input: [
							{
								type: "units",
								query: {
									distance: "close",
									selector: {
										type: "item",
										itemUid: "payer",
									},
								},
								units: {
									from: "target",
									cost: 1,
								},
							},
						],
					},
				],
			},
		},
	});
};
