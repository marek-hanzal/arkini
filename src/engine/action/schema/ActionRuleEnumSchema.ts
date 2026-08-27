import { z } from "zod";

/** Discriminates availability rules shared by immediate item actions. */
export const ActionRuleEnumSchema = z
	.enum({
		Enable: "enable",
		Disable: "disable",
	})
	.meta({
		id: "ActionRuleEnumSchema",
		description: "The kind of availability rule evaluated for an immediate item action.",
	});

export type ActionRuleEnumSchema = typeof ActionRuleEnumSchema;

export namespace ActionRuleEnumSchema {
	export type Type = z.infer<ActionRuleEnumSchema>;
}
