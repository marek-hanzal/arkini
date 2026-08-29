import { z } from "zod";

/** Discriminates availability rules shared by immediate item actions. */
export const RuleTypeSchema = z
	.enum({
		Enable: "enable",
		Disable: "disable",
	})
	.meta({
		id: "action.RuleTypeSchema",
		description: "The kind of availability rule evaluated for an immediate item action.",
	});

export type RuleTypeSchema = typeof RuleTypeSchema;

export namespace RuleTypeSchema {
	export type Type = z.infer<RuleTypeSchema>;
}
