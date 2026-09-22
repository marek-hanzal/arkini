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
							itemId,
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
															itemId: "blocker",
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
		items: {
			...base.items,
			temporaryPlain: {
				...base.items.temporaryPlain,
				clock: {
					durationMs: markerDuration,
					onExpire: outcome("blocker"),
				},
			},
			temporaryOutput: {
				...base.items.temporaryOutput,
				clock: {
					durationMs: 600,
					onExpire: outcome("result", true),
				},
			},
			payer: {
				...base.items.blocker,
				uid: "payer",
				id: "payer",
				units: {
					amount: 1,
					outcome: outcome("result", true),
				},
			},
			producer: {
				...producer,
				maxQueueSize: 2,
				units:
					path === "deferred-depletion"
						? {
								amount: 1,
								outcome: outcome("result", true),
							}
						: undefined,
				lines: [
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
						id: "spend",
						outcome: undefined,
						input: [
							{
								type: "units",
								query: {
									distance: "close",
									selector: {
										type: "item",
										itemId: "payer",
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
