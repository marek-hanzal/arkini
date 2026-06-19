import { z } from "zod";

const IdSchema = z.string().min(1);

export const GameActionProducerProductLineSetEnabledSchema = z
	.object({
		enabled: z.boolean(),
		producerItemInstanceId: IdSchema,
		productId: IdSchema,
		type: z.literal("producer.product_line.set_enabled"),
	})
	.strict();

export type GameActionProducerProductLineSetEnabledSchema =
	typeof GameActionProducerProductLineSetEnabledSchema;

export namespace GameActionProducerProductLineSetEnabledSchema {
	export type Type = z.infer<typeof GameActionProducerProductLineSetEnabledSchema>;
}
