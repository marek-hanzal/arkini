import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import type { RollSchema } from "~/outcome/schema/RollSchema";
import type { RollSetSchema } from "~/outcome/schema/RollSetSchema";

const itemOutcome = {
	type: "item",
	itemUid: "",
	quantity: {
		min: 1,
		max: 1,
	},
	placement: "drop",
	rules: [],
} satisfies OutcomeSchema.Type;

const drops = [] as unknown as [
	OutcomeSchema.Type,
	...OutcomeSchema.Type[],
];

const rolls = {
	guaranteed: {
		type: "guaranteed",
		outcome: drops,
	},
	chance: {
		type: "chance",
		chance: 0.5,
		outcome: drops,
	},
} satisfies Record<RollSchema.Type["type"], RollSchema.Type>;

const query = {
	distance: "far",
	selector: {
		type: "item",
		itemUid: "",
	},
} satisfies QuerySchema.Type;

/** Defaults cloned by production-line controls when adding nested contracts. */
export const DraftDefaults = {
	inputs: {
		materials: {
			type: "materials",
			query,
			mode: "consume",
			quantity: {
				min: 1,
				max: 1,
			},
		},
		units: {
			type: "units",
			units: {
				cost: 1,
				from: "target",
			},
			query: {
				distance: "close",
				selector: {
					type: "item",
					itemUid: "",
				},
			},
		},
	} satisfies Record<LineInputSchema.Type["type"], LineInputSchema.Type>,
	itemOutcome,
	rolls,
	outcome: {
		set: [
			{
				weight: 1,
				rules: [],
				roll: [] as unknown as RollSetSchema.Type["roll"],
			},
		] as [
			RollSetSchema.Type,
		],
	} satisfies OutcomeTableSchema.Type,
	conditionQuery: query,
} as const;
