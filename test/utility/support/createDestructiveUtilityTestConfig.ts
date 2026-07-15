import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

export const createDestructiveUtilityTestConfig = () => {
	const config = createJobTestConfig();

	return GameConfigSchema.parse({
		...config,
		items: {
			...config.items,
			cheat: {
				id: "cheat",
				type: "cheat:inventory",
				title: "Cheat sink",
				description: "Consumes board items dropped onto it.",
				asset: {
					source: [
						"asset:cheat",
					],
				},
				tags: [],
				categoryId: "utility",
				scope: "board",
				maxCount: 1,
				maxStackSize: 1,
			},
		},
	});
};
