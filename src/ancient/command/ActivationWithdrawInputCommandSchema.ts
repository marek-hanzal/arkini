import { z } from "zod";
import { WithdrawActivationInputSchema } from "~/activation/type/WithdrawActivationInputSchema";

export const ActivationWithdrawInputCommandSchema = WithdrawActivationInputSchema.extend({
	type: z.literal("activation.withdrawInput"),
});

type ActivationWithdrawInputCommandSchema = typeof ActivationWithdrawInputCommandSchema;
export namespace ActivationWithdrawInputCommandSchema {
	export type Type = z.infer<ActivationWithdrawInputCommandSchema>;
}
