import { z } from "zod";

const IdSchema = z.string().min(1);

export const GameActionProducerInputWithdrawSchema = z
	.object({
		itemId: IdSchema,
		producerItemInstanceId: IdSchema,
		lineId: IdSchema,
		type: z.literal("producer.input.withdraw"),
	})
	.strict();

export type GameActionProducerInputWithdrawSchema = typeof GameActionProducerInputWithdrawSchema;

export namespace GameActionProducerInputWithdrawSchema {
	export type Type = z.infer<typeof GameActionProducerInputWithdrawSchema>;
}
