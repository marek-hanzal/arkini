import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createTemporaryLifetimeTestConfig } from "~test/temporary-item/fx/temporaryLifetime.test/createTemporaryLifetimeTestConfig";

export type OutputPath = "expiry" | "line" | "deferred-depletion" | "immediate-depletion";

const output = (itemId: string, conditional = false) => ({
	set: [
		{
			weight: 1,
			roll: [
				{
					type: "guaranteed",
					drop: [
						{
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
														scope: "any",
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
	if (producer?.type !== "producer") throw new Error("Expected producer fixture.");
	const line = producer.lines[0];
	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			temporaryPlain: {
				...base.items.temporaryPlain,
				durationMs: markerDuration,
				output: output("blocker"),
			},
			temporaryOutput: {
				...base.items.temporaryOutput,
				durationMs: 600,
				output: output("result", true),
			},
			payer: {
				...base.items.blocker,
				uid: "payer",
				id: "payer",
				charges: {
					amount: 1,
					output: output("result", true),
				},
			},
			producer: {
				...producer,
				maxQueueSize: 2,
				charges:
					path === "deferred-depletion"
						? {
								amount: 1,
								output: output("result", true),
							}
						: undefined,
				lines: [
					{
						...line,
						runtimeMs: 600,
						input: [
							{
								type: "simple",
								charges:
									path === "deferred-depletion"
										? {
												from: "self",
												cost: 1,
											}
										: undefined,
							},
						],
						output: path === "line" ? output("result", true) : undefined,
					},
					{
						...line,
						id: "spend",
						output: undefined,
						input: [
							{
								type: "deposit",
								query: {
									scope: "board",
									distance: "close",
									selector: {
										type: "item",
										itemId: "payer",
									},
								},
								charges: {
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
