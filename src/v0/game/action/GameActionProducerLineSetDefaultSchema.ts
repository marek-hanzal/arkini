import { z } from "zod";

const IdSchema = z.string().min(1);

export const GameActionProducerLineSetDefaultSchema = z
	.object({
		producerItemInstanceId: IdSchema,
		lineId: IdSchema,
		type: z.literal("producer.line.set_default"),
	})
	.strict();

export type GameActionProducerLineSetDefaultSchema = typeof GameActionProducerLineSetDefaultSchema;

export namespace GameActionProducerLineSetDefaultSchema {
	export type Type = z.infer<typeof GameActionProducerLineSetDefaultSchema>;
}
