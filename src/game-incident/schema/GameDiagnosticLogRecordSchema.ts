import { z } from "zod";

import { DiagnosticValueSchema } from "~electron/contract/diagnostics/DiagnosticRecord";
import { GameDiagnosticHistoryEntrySchema } from "~/game-incident/schema/GameDiagnosticHistorySchema";
import { GameDiagnosticItemReferenceSchema } from "~/game-incident/schema/GameDiagnosticReferenceSchema";

/** Exact LogTape JSON-lines record emitted by Arkini's process diagnostic sink. */
export const GameDiagnosticLogRecordSchema = z
	.object({
		"@timestamp": z.iso.datetime(),
		level: z.enum([
			"DEBUG",
			"INFO",
			"WARNING",
			"ERROR",
			"FATAL",
		]),
		message: z.string().min(1),
		logger: z.string().min(1),
		properties: z.record(z.string(), DiagnosticValueSchema),
	})
	.strict();

export namespace GameDiagnosticLogRecordSchema {
	export type Type = z.infer<typeof GameDiagnosticLogRecordSchema>;
}

export const GameDiagnosticSessionStartedDataSchema = z
	.object({
		applicationVersion: z.string().min(1),
		packageId: z.string().min(1),
		contentHash: z.string().min(1),
		arkini: z.string().min(1),
		gameVersion: z.string().min(1),
		restored: z.boolean(),
		startedAt: z.iso.datetime(),
	})
	.strict();

export const GameDiagnosticRuntimeCommittedDataSchema = z
	.object({
		sequence: z.number().int().nonnegative(),
		eventTypes: z.array(z.string().min(1)).max(100),
		history: GameDiagnosticHistoryEntrySchema,
		historyTruncated: z.boolean(),
	})
	.strict();

export const GameDiagnosticSessionFailedDataSchema = z
	.object({
		source: z.string().min(1),
		error: DiagnosticValueSchema,
		errorTruncated: z.boolean(),
		sequence: z.number().int().nonnegative(),
		lastCommitted: DiagnosticValueSchema,
		lastCommittedTruncated: z.boolean(),
		relatedItems: z.array(GameDiagnosticItemReferenceSchema).max(100),
		relatedItemsTruncated: z.boolean(),
	})
	.strict();
