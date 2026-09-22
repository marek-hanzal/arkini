import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

/** Creates one line whose outcome item can be removed after start to force a Tick failure. */
export const createTickFailureTestConfig = () => {
	const base = createJobTestConfig(1);
	const forge = base.items.forge;
	const line = forge.lines[0];
	if (line === undefined) throw new Error("Expected producer line fixture.");

	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			completionOutput: {
				...base.items.tool,
				uid: "completionOutput",
				id: "completionOutput",
				title: "Tick failure outcome",
				description: "Removed after start by the test.",
			},
			forge: {
				...forge,
				lines: [
					{
						...line,
						runtimeMs: 200,
						input: [
							{
								type: "simple",
							},
						],
						outcome: {
							set: [
								{
									rules: [],
									roll: [
										{
											type: "guaranteed",
											outcome: [
												{
													type: "item" as const,
													itemId: "completionOutput",
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
						rules: [],
					},
				],
			},
		},
	});
};
