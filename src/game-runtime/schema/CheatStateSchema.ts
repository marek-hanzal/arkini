import { z } from "zod";

/** Persisted cheat switches owned by one exact Game runtime and save. */
export const CheatStateSchema = z
	.object({
		enabled: z.boolean().describe("Whether cheat behavior is enabled for this exact save."),
		everEnabled: z
			.boolean()
			.describe("Whether Cheat mode has ever been enabled for this exact save."),
		speedUpGameplay: z
			.boolean()
			.describe(
				"Whether simulation runs at the fixed application speed-up multiplier while cheats are enabled.",
			),
	})
	.strict()
	.meta({
		id: "CheatStateSchema",
		description: "Persisted cheat switches owned by one exact Game runtime and save.",
	});

export type CheatStateSchema = typeof CheatStateSchema;

export namespace CheatStateSchema {
	export type Type = z.infer<CheatStateSchema>;
}
