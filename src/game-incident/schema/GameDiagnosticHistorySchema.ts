import { z } from "zod";

import { DiagnosticValueSchema } from "~electron/contract/diagnostics/DiagnosticRecord";
import { IdSchema } from "~/game-config/schema/IdSchema";
import {
	GameDiagnosticEventSchema,
	GameDiagnosticItemReferenceSchema,
	GameDiagnosticJobReferenceSchema,
	GameDiagnosticQueueReferenceSchema,
} from "~/game-incident/schema/GameDiagnosticReferenceSchema";

const GameDiagnosticDefaultLineChangeSchema = z
	.object({
		owner: GameDiagnosticItemReferenceSchema,
		previousLineId: IdSchema.nullable(),
		lineId: IdSchema.nullable(),
	})
	.strict();

const GameDiagnosticDeliverySchema = z
	.object({
		item: GameDiagnosticItemReferenceSchema,
		quantity: z.number().int().positive(),
		generation: z.number().int().nonnegative(),
		phase: z.enum([
			"outbound",
			"returning",
		]),
		origin: DiagnosticValueSchema,
		endpoint: DiagnosticValueSchema,
	})
	.strict();

export const GameDiagnosticHistoryEntrySchema = z
	.object({
		sequence: z.number().int().nonnegative(),
		observedAt: z.iso.datetime(),
		elapsedSincePreviousMs: z.number().int().nonnegative().nullable(),
		initial: z.boolean(),
		events: z.array(GameDiagnosticEventSchema).max(100),
		itemCount: z.number().int().nonnegative(),
		jobCount: z.number().int().nonnegative(),
		queueCount: z.number().int().nonnegative(),
		jobsAdded: z.array(GameDiagnosticJobReferenceSchema).max(100),
		jobsRemoved: z.array(GameDiagnosticJobReferenceSchema).max(100),
		queueAdded: z.array(GameDiagnosticQueueReferenceSchema).max(100),
		queueRemoved: z.array(GameDiagnosticQueueReferenceSchema).max(100),
		defaultLinesChanged: z.array(GameDiagnosticDefaultLineChangeSchema).max(100),
		deliveries: z.array(GameDiagnosticDeliverySchema).max(100),
		truncated: z.boolean(),
	})
	.strict();

export namespace GameDiagnosticHistoryEntrySchema {
	export type Type = z.infer<typeof GameDiagnosticHistoryEntrySchema>;
}

export interface GameDiagnosticHistory {
	readonly retainedLimit: number;
	readonly totalEntries: number;
	readonly entries: readonly GameDiagnosticHistoryEntrySchema.Type[];
}
