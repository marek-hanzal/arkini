import { z } from "zod";
import { ItemOutcomeSchema } from "./ItemOutcomeSchema";
import { SpaceOutcomeSchema } from "./SpaceOutcomeSchema";
export const OutcomeSchema = z
	.discriminatedUnion("type", [
		ItemOutcomeSchema,
		SpaceOutcomeSchema,
	])
	.meta({
		id: "OutcomeSchema",
		description: "One authored item or space outcome.",
	});
export type OutcomeSchema = typeof OutcomeSchema;
export namespace OutcomeSchema {
	export type Type = z.infer<OutcomeSchema>;
}
