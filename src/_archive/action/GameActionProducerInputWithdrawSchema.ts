import { z } from "zod";

const IdSchema = z.string().min(1);

export const GameActionProducerInputWithdrawSchema = z
	.object({
		itemId: IdSchema,
		itemInstanceId: IdSchema,
		lineId: IdSchema,
		type: z.literal("producer.input.withdraw"),
	})
	.strict();

export namespace GameActionProducerInputWithdrawSchema {
	export type Type = z.infer<typeof GameActionProducerInputWithdrawSchema>;
}
