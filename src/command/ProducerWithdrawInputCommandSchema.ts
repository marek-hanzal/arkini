import { z } from "zod";
import { WithdrawProducerInputSchema } from "~/play/schema/WithdrawProducerInputSchema";

export const ProducerWithdrawInputCommandSchema = WithdrawProducerInputSchema.extend({
	type: z.literal("producer.withdrawInput"),
});

type ProducerWithdrawInputCommandSchema = typeof ProducerWithdrawInputCommandSchema;
export namespace ProducerWithdrawInputCommandSchema {
	export type Type = z.infer<ProducerWithdrawInputCommandSchema>;
}
