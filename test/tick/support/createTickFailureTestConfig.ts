import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

/** Creates one line whose output item can be removed after start to force a Tick failure. */
export const createTickFailureTestConfig = () => {
	const base = createJobTestConfig(1);
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	const line = forge.lines[0];
	if (line === undefined) throw new Error("Expected producer line fixture.");

	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			inventoryOutput: {
				...base.items.tool,
				id: "inventoryOutput",
				title: "Tick failure output",
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
						output: {
							set: [
								{
									roll: [
										{
											type: "guaranteed",
											drop: [
												{
													itemId: "inventoryOutput",
													quantity: {
														type: "value",
														value: 1,
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
