import { z } from "zod";

/** Why one authored input charge contract cannot resolve a valid payer. */
export const InvalidInputChargesReasonEnumSchema = z
	.enum({
		DepositMissingTargetCost: "deposit-missing-target-cost",
		DepositMustTarget: "deposit-must-target",
		TargetRequiresDeposit: "target-requires-deposit",
		SelfMissingCharges: "self-missing-charges",
		SelfInsufficientCharges: "self-insufficient-charges",
		TargetUnavailable: "target-unavailable",
		TargetInsufficientTotalCharges: "target-insufficient-total-charges",
	})
	.meta({
		id: "InvalidInputChargesReasonEnumSchema",
		description: "Why one authored input charge contract cannot resolve a valid payer.",
	});

export type InvalidInputChargesReasonEnumSchema = typeof InvalidInputChargesReasonEnumSchema;

export namespace InvalidInputChargesReasonEnumSchema {
	export type Type = z.infer<InvalidInputChargesReasonEnumSchema>;
}
