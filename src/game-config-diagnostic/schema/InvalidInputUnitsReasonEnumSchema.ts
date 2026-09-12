import { z } from "zod";

/** Why one authored input unit contract cannot resolve a valid payer. */
export const InvalidInputUnitsReasonEnumSchema = z
	.enum({
		UnitsMissingTargetCost: "units-missing-target-cost",
		TargetRequiresUnits: "target-requires-units",
		SelfMissingUnits: "self-missing-units",
		SelfInsufficientUnits: "self-insufficient-units",
		TargetUnavailable: "target-unavailable",
		TargetInsufficientTotalUnits: "target-insufficient-total-units",
	})
	.meta({
		id: "InvalidInputUnitsReasonEnumSchema",
		description: "Why one authored input unit contract cannot resolve a valid payer.",
	});

export type InvalidInputUnitsReasonEnumSchema = typeof InvalidInputUnitsReasonEnumSchema;

export namespace InvalidInputUnitsReasonEnumSchema {
	export type Type = z.infer<InvalidInputUnitsReasonEnumSchema>;
}
