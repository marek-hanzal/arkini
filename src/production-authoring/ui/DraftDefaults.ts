import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { RollSchema } from "~/production-output/schema/RollSchema";
import type { RollSetSchema } from "~/production-output/schema/RollSetSchema";
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

const drops = [] as unknown as [
	DropSchema.Type,
	...DropSchema.Type[],
];

const rolls = {
	guaranteed: {
		type: "guaranteed",
		drop: drops,
	},
	chance: {
		type: "chance",
		chance: 0.5,
		drop: drops,
	},
} satisfies Record<RollSchema.Type["type"], RollSchema.Type>;

// Roll type is the first deliberate authoring choice; canonical validation
// keeps this incomplete draft from being saved before that choice is made.
const roll = {} as RollSchema.Type;

const query = {
	scope: "any",
	selector: {
		type: "item",
		itemId: "",
	},
} satisfies QuerySchema.Type;

/** Defaults cloned by production-line controls when adding nested contracts. */
export const DraftDefaults = {
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
		},
		units: {
			type: "units",
			units: {
				cost: 1,
				from: "target",
			},
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
	roll,
	rolls,
	output: {
		set: [
			{
				weight: 1,
				rules: [],
				roll: [] as unknown as RollSetSchema.Type["roll"],
			},
		] as [
			RollSetSchema.Type,
		],
	} satisfies OutputSchema.Type,
	// Condition type is a deliberate authoring choice. Keeping the query in the
	// incomplete draft lets type changes preserve the shared selector and scope.
	when: {
		query,
	} as unknown as WhenSchema.Type,
} as const;
