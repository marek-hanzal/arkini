import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { RollSchema } from "~/production-output/roll/schema/RollSchema";
import type { SetSchema } from "~/production-output/roll/schema/SetSchema";
import type { WeightedDropSchema } from "~/production-output/roll/schema/WeightedDropSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";

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

/** Defaults cloned by production-line controls when adding nested contracts. */
export const EditorProductionDraftDefaults = {
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
	when: {
		type: "exists",
		query,
	} satisfies WhenSchema.Type,
} as const;
