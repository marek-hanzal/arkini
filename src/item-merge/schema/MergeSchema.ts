import { z } from "zod";

import { IdSchema } from "~/game-config/schema/IdSchema";
import { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import { OutputSchema } from "~/production-output/schema/OutputSchema";
import { SourceActionSchema } from "./SourceActionSchema";
import { TargetEffectSchema } from "./TargetEffectSchema";

const BaseSchema = z
	.object({
		target: SelectorSchema.describe(
			"The selector that must match the receiving item for this merge to apply.",
		),
		action: SourceActionSchema.describe(
			"The action applied to the source item after this merge resolves.",
		),
		output: OutputSchema.optional().describe(
			"The optional extra output evaluated after this merge resolves.",
		),
	})
	.strict()
	.meta({
		id: "merge.BaseSchema",
		description:
			"The common source action, target selector, and output fields shared by directional item merges.",
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

/**
 * A target-specific directional interaction initiated by dropping its owning
 * item onto another item.
 *
 * Source handling and target effects are separate: `action` describes the
 * source item, while this union's `effect` describes the matched target.
 */
export const MergeSchema = z
	.discriminatedUnion("effect", [
		KeepSchema,
		RemoveSchema,
		ReplaceSchema,
	])
	.meta({
		id: "MergeSchema",
		description: "A discriminated target-specific directional item merge.",
	});

export type MergeSchema = typeof MergeSchema;

export namespace MergeSchema {
	export type Type = z.infer<MergeSchema>;
}
