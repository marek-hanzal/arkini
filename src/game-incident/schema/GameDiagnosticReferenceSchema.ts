import { z } from "zod";

import { DiagnosticValueSchema } from "~electron/contract/diagnostics/DiagnosticRecord";
import { IdSchema } from "~/game-value/schema/IdSchema";

export const GameDiagnosticItemDefinitionReferenceSchema = z
	.object({
		itemId: IdSchema,
		itemUid: IdSchema,
		title: z.string(),
	})
	.strict();

export namespace GameDiagnosticItemDefinitionReferenceSchema {
	export type Type = z.infer<typeof GameDiagnosticItemDefinitionReferenceSchema>;
}

export const GameDiagnosticItemReferenceSchema = z
	.object({
		runtimeItemId: IdSchema.nullable(),
		definition: GameDiagnosticItemDefinitionReferenceSchema.nullable(),
	})
	.strict();

export namespace GameDiagnosticItemReferenceSchema {
	export type Type = z.infer<typeof GameDiagnosticItemReferenceSchema>;
}

export const GameDiagnosticJobReferenceSchema = z
	.object({
		jobId: IdSchema,
		lineId: IdSchema,
		owner: GameDiagnosticItemReferenceSchema,
	})
	.strict();

export namespace GameDiagnosticJobReferenceSchema {
	export type Type = z.infer<typeof GameDiagnosticJobReferenceSchema>;
}

export const GameDiagnosticQueueReferenceSchema = z
	.object({
		requestId: IdSchema,
		lineId: IdSchema,
		owner: GameDiagnosticItemReferenceSchema,
	})
	.strict();

export namespace GameDiagnosticQueueReferenceSchema {
	export type Type = z.infer<typeof GameDiagnosticQueueReferenceSchema>;
}

export const GameDiagnosticEventSchema = z
	.object({
		type: z.string().min(1),
		details: DiagnosticValueSchema,
		relatedItems: z.array(GameDiagnosticItemReferenceSchema).max(100),
	})
	.strict();

export namespace GameDiagnosticEventSchema {
	export type Type = z.infer<typeof GameDiagnosticEventSchema>;
}
