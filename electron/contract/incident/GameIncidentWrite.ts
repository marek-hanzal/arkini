import { z } from "zod";

import { DiagnosticRecordSchema } from "../diagnostics/DiagnosticRecord";

export const GameIncidentWriteSchema = z
	.object({
		arkpackBytes: z.instanceof(Uint8Array),
		saveBytes: z.instanceof(Uint8Array),
		diagnostics: z.array(DiagnosticRecordSchema).min(2).max(64),
	})
	.strict();

export type GameIncidentWrite = z.infer<typeof GameIncidentWriteSchema>;
