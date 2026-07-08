import { z } from "zod";
import { MergeEmitOutputSchema } from "./MergeEmitOutputSchema";
import { MergeIntoItemSchema } from "./MergeIntoItemSchema";

export const MergeRuleSchema = z.discriminatedUnion("type", [
	MergeIntoItemSchema,
	MergeEmitOutputSchema,
]);
