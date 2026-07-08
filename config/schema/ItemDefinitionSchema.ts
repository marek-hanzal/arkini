import { z } from "zod";
import { BuildSchema } from "./BuildSchema";
import { CapacitySchema } from "./CapacitySchema";
import { CraftSchema } from "./CraftSchema";
import { IdSchema } from "./IdSchema";
import { IntegerSchema } from "./IntegerSchema";
import { ItemFactsSchema } from "./ItemFactsSchema";
import { ItemKindSchema } from "./ItemKindSchema";
import { MergeRuleSchema } from "./MergeRuleSchema";
import { ProducerSchema } from "./ProducerSchema";
import { RemoveByRuleSchema } from "./RemoveByRuleSchema";
import { StashSchema } from "./StashSchema";
import { StorageSchema } from "./StorageSchema";
import { CountSchema } from "./CountSchema";

export const ItemDefinitionSchema = z.object({
	id: IdSchema,
	kind: ItemKindSchema,
	name: z.string(),
	label: z.string().optional(),
	description: z.string().optional(),
	assetIds: z.array(IdSchema).optional(),
	tags: z.array(IdSchema).optional(),
	tier: IntegerSchema.optional(),
	storage: StorageSchema.optional(),
	maxStackSize: CountSchema.optional(),
	maxCount: CountSchema.optional(),
	facts: ItemFactsSchema.optional(),
	capacity: CapacitySchema.optional(),
	removeBy: z.array(RemoveByRuleSchema).optional(),
	merges: z.array(MergeRuleSchema).optional(),
	craft: CraftSchema.optional(),
	build: BuildSchema.optional(),
	producer: ProducerSchema.optional(),
	stash: StashSchema.optional(),
});
