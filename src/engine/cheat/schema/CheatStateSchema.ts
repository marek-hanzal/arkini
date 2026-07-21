import { z } from "zod";

/** Persisted cheat switches owned by one exact Game runtime and save. */
export const CheatStateSchema = z
	.object({
		enabled: z.boolean().describe("Whether cheat-only commands and surfaces are enabled."),
		instantGameplay: z
			.boolean()
			.describe("Whether valid time-based gameplay completes without wall-clock waiting."),
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
