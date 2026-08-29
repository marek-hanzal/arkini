import type { InputSchema as LineInputSchema } from "~/engine/input/schema/InputSchema";
import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import type { QuerySchema } from "~/engine/query/schema/QuerySchema";
import type { RollSchema } from "~/engine/roll/schema/RollSchema";
import type { SetSchema } from "~/engine/roll/schema/SetSchema";
import type { WeightedDropSchema } from "~/engine/roll/schema/WeightedDropSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

const drop = {
	itemId: "",
	quantity: {
		min: 1,
		max: 1,
	},
	placement: "drop",
	rules: [],
} satisfies DropSchema.Type;

const rolls = {
	guaranteed: {
		type: "guaranteed",
		drop: [
			drop,
		] as [
			DropSchema.Type,
		],
	},
	chance: {
		type: "chance",
		chance: 0.5,
		drop: [
			drop,
		] as [
			DropSchema.Type,
		],
	},
	weight: {
		type: "weight",
		quantity: {
			min: 1,
			max: 1,
		},
		drop: [
			{
				weight: 1,
				drop: [
					structuredClone(drop),
				] as [
					DropSchema.Type,
				],
			},
			{
				weight: 1,
				drop: [
					structuredClone(drop),
				] as [
					DropSchema.Type,
				],
			},
		] as [
			WeightedDropSchema.Type,
			WeightedDropSchema.Type,
			...WeightedDropSchema.Type[],
		],
	},
} satisfies Record<RollSchema.Type["type"], RollSchema.Type>;

const query = {
	scope: "any",
	selector: {
		type: "item",
		itemId: "",
	},
} satisfies QuerySchema.Type;

/** Presentation-only defaults cloned by local item forms when adding nested values. */
export const EditorItemDraftDefaults = {
	inputs: {
		simple: {
			type: "simple",
		},
		materials: {
			type: "materials",
			selector: {
				type: "item",
				itemId: "",
			},
			mode: "consume",
			quantity: {
				min: 1,
				max: 1,
			},
			capacity: 0,
		},
		deposit: {
			type: "deposit",
			query: {
				scope: "board",
				distance: "close",
				selector: {
					type: "item",
					itemId: "",
				},
			},
		},
	} satisfies Record<LineInputSchema.Type["type"], LineInputSchema.Type>,
	drop,
	rolls,
	output: {
		set: [
			{
				weight: 1,
				roll: [
					rolls.guaranteed,
				] as [
					RollSchema.Type,
				],
			},
		] as [
			SetSchema.Type,
		],
	} satisfies OutputSchema.Type,
	merge: {
		target: {
			type: "item",
			itemId: "",
		},
		action: "use",
		effect: "keep",
	} satisfies MergeSchema.Type,
	when: {
		type: "exists",
		query,
	} satisfies WhenSchema.Type,
} as const;
