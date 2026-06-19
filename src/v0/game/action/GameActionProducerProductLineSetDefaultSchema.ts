import { z } from "zod";

const IdSchema = z.string().min(1);

export const GameActionProducerProductLineSetDefaultSchema = z
	.object({
		producerItemInstanceId: IdSchema,
		productId: IdSchema,
		type: z.literal("producer.product_line.set_default"),
	})
	.strict();

export type GameActionProducerProductLineSetDefaultSchema =
	typeof GameActionProducerProductLineSetDefaultSchema;

export namespace GameActionProducerProductLineSetDefaultSchema {
	export type Type = z.infer<typeof GameActionProducerProductLineSetDefaultSchema>;
}
