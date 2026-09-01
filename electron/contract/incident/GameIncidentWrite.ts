import { z } from "zod";

export const GameIncidentWriteSchema = z
	.object({
		arkpackBytes: z.instanceof(Uint8Array),
		saveBytes: z.instanceof(Uint8Array),
		text: z
			.object({
				incident: z
					.string()
					.min(1)
					.max(256 * 1_024),
				failure: z
					.string()
					.min(1)
					.max(512 * 1_024),
				history: z
					.string()
					.min(1)
					.max(2 * 1_024 * 1_024),
				runtimeState: z
					.string()
					.min(1)
					.max(8 * 1_024 * 1_024),
			})
			.strict(),
	})
	.strict();

export type GameIncidentWrite = z.infer<typeof GameIncidentWriteSchema>;
