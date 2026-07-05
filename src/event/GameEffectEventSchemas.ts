import { z } from "zod";
import { IdSchema } from "~/event/GameEventBaseSchemas";
import { GameInstantMsSchema } from "~/time/GameTimeSchema";

export const GameEffectActivatedEventSchema = z
	.object({
		type: z.literal("effect.activated"),
		atMs: GameInstantMsSchema,
		id: IdSchema,
		effectId: IdSchema,
		sourceItemInstanceId: IdSchema,
		startAtMs: GameInstantMsSchema,
		endAtMs: GameInstantMsSchema,
		producerJobId: IdSchema.optional(),
	})
	.strict();

export const GameEffectExpiredEventSchema = z
	.object({
		type: z.literal("effect.expired"),
		id: IdSchema,
		effectId: IdSchema,
		sourceItemInstanceId: IdSchema,
		producerJobId: IdSchema.optional(),
		atMs: GameInstantMsSchema,
	})
	.strict();
