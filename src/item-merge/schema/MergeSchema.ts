import { z } from "zod";

import { SpaceDestinationSchema } from "~/space/schema/SpaceDestinationSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { SourceActionSchema } from "./SourceActionSchema";
import { TargetEffectSchema } from "./TargetEffectSchema";

const BaseSchema = z
	.object({
		target: SelectorSchema.describe(
			"The selector that must match the receiving item for this merge to apply.",
		),
		action: SourceActionSchema.exclude([
			"Space",
		]).describe("The action applied to the source item after this merge resolves."),
		outcome: OutcomeTableSchema.optional().describe(
			"The optional extra outcome evaluated after this merge resolves.",
		),
	})
	.strict()
	.meta({
		id: "merge.BaseSchema",
		description:
			"The common source action, target selector, and outcome fields shared by directional item merges.",
	});

const KeepSchema = z
	.object({
		...BaseSchema.shape,
		effect: TargetEffectSchema.extract([
			"Keep",
		]).describe("Identifies this merge as one that keeps its selected target unchanged."),
	})
	.strict()
	.meta({
		id: "merge.KeepSchema",
		description: "A merge that leaves its selected receiving item unchanged.",
	});

const RemoveSchema = z
	.object({
		...BaseSchema.shape,
		effect: TargetEffectSchema.extract([
			"Remove",
		]).describe("Identifies this merge as one that removes its selected target."),
	})
	.strict()
	.meta({
		id: "merge.RemoveSchema",
		description: "A merge that removes its selected receiving item.",
	});

const SpendSchema = z
	.object({
		...BaseSchema.shape,
		effect: TargetEffectSchema.extract([
			"Spend",
		]).describe("Identifies this merge as one that spends a unit from its selected target."),
	})
	.strict()
	.meta({
		id: "merge.SpendSchema",
		description: "A merge that spends one unit from its selected receiving item.",
	});

const ReplaceSchema = z
	.object({
		...BaseSchema.shape,
		effect: TargetEffectSchema.extract([
			"Replace",
		]).describe("Identifies this merge as one that replaces its selected target."),
		result: IdSchema.describe("The canonical item that replaces the selected target."),
	})
	.strict()
	.meta({
		id: "merge.ReplaceSchema",
		description: "A merge that replaces its selected receiving item with an explicit result.",
	});

const SpaceBaseSchema = z
	.object({
		action: SourceActionSchema.extract([
			"Space",
		]),
		space: SpaceDestinationSchema.describe(
			"The destination Board space for the incoming item.",
		),
		outcome: OutcomeTableSchema.optional(),
	})
	.strict();

/** Source-owned directional merges and receiver-owned transport share target effects and outcomes. */
export const MergeSchema = z
	.discriminatedUnion("action", [
		z.discriminatedUnion("effect", [
			SpendSchema,
			KeepSchema,
			RemoveSchema,
			ReplaceSchema,
		]),
		z.discriminatedUnion("effect", [
			SpaceBaseSchema.extend({
				effect: TargetEffectSchema.extract([
					"Keep",
				]),
			}),
			SpaceBaseSchema.extend({
				effect: TargetEffectSchema.extract([
					"Remove",
				]),
			}),
			SpaceBaseSchema.extend({
				effect: TargetEffectSchema.extract([
					"Spend",
				]),
			}),
			SpaceBaseSchema.extend({
				effect: TargetEffectSchema.extract([
					"Replace",
				]),
				result: IdSchema,
			}),
		]),
	])
	.meta({
		id: "MergeSchema",
		description: "A source-owned directional merge or receiver-owned Space transport.",
	});

export type MergeSchema = typeof MergeSchema;
export namespace MergeSchema {
	export type Type = z.infer<MergeSchema>;
}
