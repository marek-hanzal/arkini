import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import type { UnitsSchema } from "~/item-definition/schema/UnitsSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const simpleItem = ({
	units,
	id,
	merge,
}: {
	units?: UnitsSchema.Type;
	id: string;
	merge?: readonly [
		MergeSchema.Type,
		...MergeSchema.Type[],
	];
}) => ({
	maxQueueSize: 1,
	lines: [],

	uid: id,
	id,
	title: id,
	description: id,
	units,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${id}`,
		],
	},
	merge,
});

export const createMergeTestConfig = ({
	board = {
		width: 4,
		height: 2,
	},
	rule,
	sourceUnits,
	targetUnits,
}: {
	board?: {
		width: number;
		height: number;
	};
	rule:
		| MergeSchema.Type
		| readonly [
				MergeSchema.Type,
				...MergeSchema.Type[],
		  ];
	sourceUnits?: UnitsSchema.Type;
	targetUnits?: UnitsSchema.Type;
}) =>
	GameConfigSchema.parse({
		resources: {
			hero: "hero",
		},
		meta: {
			id: "game:merge-test",
			title: "Merge test",
			board,
		},
		start: {
			currentSpace: 0,
		},
		items: {
			source: simpleItem({
				units: sourceUnits,
				id: "source",

				merge: Array.isArray(rule)
					? (rule as [
							MergeSchema.Type,
							...MergeSchema.Type[],
						])
					: [
							rule as MergeSchema.Type,
						],
			}),
			target: simpleItem({
				units: targetUnits,
				id: "target",
			}),
			result: simpleItem({
				id: "result",
			}),
			output: simpleItem({
				id: "output",
			}),
			"output:a": simpleItem({
				id: "output:a",
			}),
			"output:b": simpleItem({
				id: "output:b",
			}),
			blocker: simpleItem({
				id: "blocker",
			}),
		},
	});

export const guaranteedMergeOutput = ({
	itemId = "output",
	placement = "drop",
	quantity = 1,
}: {
	itemId?: string;
	placement?: "drop" | "random";
	quantity?: number;
} = {}): OutcomeTableSchema.Type => ({
	set: [
		{
			weight: 1,
			rules: [],
			roll: [
				{
					type: "guaranteed",
					outcome: [
						{
							type: "item" as const,
							itemId,
							placement,
							quantity: {
								min: quantity,
								max: quantity,
							},
							rules: [],
						},
					],
				},
			],
		},
	],
});

export const weightedMergeOutput = (): OutcomeTableSchema.Type => ({
	set: [
		{
			weight: 1,
			rules: [],
			roll: [
				{
					type: "guaranteed",
					outcome: [
						{
							type: "item" as const,
							itemId: "output:a",
							placement: "drop",
							quantity: {
								min: 2,
								max: 2,
							},
							rules: [],
						},
					],
				},
			],
		},
		{
			weight: 1,
			rules: [],
			roll: [
				{
					type: "guaranteed",
					outcome: [
						{
							type: "item" as const,
							itemId: "output:b",
							placement: "drop",
							quantity: {
								min: 2,
								max: 2,
							},
							rules: [],
						},
					],
				},
			],
		},
	],
});
