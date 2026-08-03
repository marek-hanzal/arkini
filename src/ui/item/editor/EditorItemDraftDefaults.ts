import type {
	EditorDrop,
	EditorDropWeight,
	EditorInput,
	EditorMerge,
	EditorOutput,
	EditorQuery,
	EditorRoll,
	EditorRollSet,
	EditorWhen,
} from "~/bridge/item/editor/EditorItemModel";

const drop = {
	itemId: "",
	quantity: {
		min: 1,
		max: 1,
	},
	placement: "drop",
	rules: [],
} satisfies EditorDrop;

const rolls = {
	guaranteed: {
		type: "guaranteed",
		drop: [
			drop,
		] as [
			EditorDrop,
		],
	},
	chance: {
		type: "chance",
		chance: 0.5,
		drop: [
			drop,
		] as [
			EditorDrop,
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
					EditorDrop,
				],
			},
			{
				weight: 1,
				drop: [
					structuredClone(drop),
				] as [
					EditorDrop,
				],
			},
		] as [
			EditorDropWeight,
			EditorDropWeight,
			...EditorDropWeight[],
		],
	},
} satisfies Record<EditorRoll["type"], EditorRoll>;

const query = {
	scope: "any",
	selector: {
		type: "item",
		itemId: "",
	},
} satisfies EditorQuery;

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
	} satisfies Record<EditorInput["type"], EditorInput>,
	drop,
	rolls,
	output: {
		set: [
			{
				roll: [
					rolls.guaranteed,
				] as [
					EditorRoll,
				],
			},
		] as [
			EditorRollSet,
		],
	} satisfies EditorOutput,
	merge: {
		target: {
			type: "item",
			itemId: "",
		},
		action: "use",
		effect: "keep",
	} satisfies EditorMerge,
	when: {
		type: "exists",
		query,
	} satisfies EditorWhen,
} as const;
