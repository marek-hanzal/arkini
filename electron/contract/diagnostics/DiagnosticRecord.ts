import { z } from "zod";

export type DiagnosticValue =
	| null
	| boolean
	| number
	| string
	| ReadonlyArray<DiagnosticValue>
	| {
			readonly [key: string]: DiagnosticValue;
	  };

const DiagnosticValueSchema: z.ZodType<DiagnosticValue> = z.lazy(() =>
	z.union([
		z.null(),
		z.boolean(),
		z.number().finite(),
		z.string().max(8_192),
		z.array(DiagnosticValueSchema).max(100),
		z.record(z.string().max(100), DiagnosticValueSchema),
	]),
);

export const DiagnosticRecordSchema = z
	.object({
		schemaVersion: z.literal(1),
		level: z.enum([
			"debug",
			"info",
			"warning",
			"error",
			"fatal",
		]),
		category: z.array(z.string().min(1).max(64)).min(1).max(8),
		event: z.string().min(1).max(120),
		sessionId: z.string().min(1).max(100).optional(),
		data: z.record(z.string().max(100), DiagnosticValueSchema).optional(),
	})
	.strict()
	.refine((record) => JSON.stringify(record).length <= 65_536, {
		message: "Diagnostic record exceeds 64 KiB.",
	});

export type DiagnosticRecord = z.infer<typeof DiagnosticRecordSchema>;
