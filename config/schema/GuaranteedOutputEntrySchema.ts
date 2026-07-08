import { z } from "zod";
import { IdSchema } from "./IdSchema";
import { IntegerSchema } from "./IntegerSchema";
import { OutputPlacementSchema } from "./OutputPlacementSchema";
import { QuantityValueSchema } from "./QuantityValueSchema";
import { RuleConditionSchema } from "./RuleConditionSchema";

export const GuaranteedOutputEntrySchema = z.object({
	kind: z.literal("guaranteed"),
	itemId: IdSchema,
	quantity: QuantityValueSchema.optional(),
	placement: OutputPlacementSchema.optional(),
	when: RuleConditionSchema.optional(),
	sort: IntegerSchema.optional(),
});
