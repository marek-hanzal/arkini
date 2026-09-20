import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { UnitsSchema } from "~/item-definition/schema/UnitsSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const simpleItem = ({
	units,
	id,
	maxStackSize = 10,
	merge,
	scope = "any",
}: {
	units?: UnitsSchema.Type;
	id: string;
	maxStackSize?: number;
	merge?: readonly [
		MergeSchema.Type,
		...MergeSchema.Type[],
	];
	scope?: "any" | "board" | "inventory";
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
	scope,
	maxStackSize,
	merge,
});

export const createMergeTestConfig = ({
	board = {
		width: 4,
		height: 2,
	},
	inventory = {
		width: 3,
		height: 1,
	},
	outputMaxStackSize = 10,
	rule,
	sourceUnits,
	sourceMaxStackSize = 10,
	sourceScope = "any",
	targetMaxStackSize = 10,
	targetUnits,
}: {
	board?: {
		width: number;
		height: number;
	};
	inventory?: {
		width: number;
		height: number;
	};
	outputMaxStackSize?: number;
	rule:
		| MergeSchema.Type
		| readonly [
				MergeSchema.Type,
				...MergeSchema.Type[],
		  ];
	sourceUnits?: UnitsSchema.Type;
	sourceMaxStackSize?: number;
	sourceScope?: "any" | "board" | "inventory";
	targetMaxStackSize?: number;
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
			inventory,
		},
		start: {
			currentSpace: 0,
		},
		items: {
			source: simpleItem({
				units: sourceUnits,
				id: "source",
				maxStackSize: sourceMaxStackSize,
				merge: Array.isArray(rule)
					? (rule as [
							MergeSchema.Type,
							...MergeSchema.Type[],
						])
					: [
							rule as MergeSchema.Type,
						],
				scope: sourceScope,
			}),
			target: simpleItem({
				units: targetUnits,
				id: "target",
				maxStackSize: targetMaxStackSize,
			}),
			result: simpleItem({
				id: "result",
			}),
			output: simpleItem({
				id: "output",
				maxStackSize: outputMaxStackSize,
			}),
			"output:a": simpleItem({
				id: "output:a",
				maxStackSize: 1,
			}),
			"output:b": simpleItem({
				id: "output:b",
				maxStackSize: 1,
			}),
			blocker: simpleItem({
				id: "blocker",
				maxStackSize: 1,
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
} = {}): OutputSchema.Type => ({
	set: [
		{
			weight: 1,
			rules: [],
			roll: [
				{
					type: "guaranteed",
					drop: [
						{
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

export const weightedMergeOutput = (): OutputSchema.Type => ({
	set: [
		{
			weight: 1,
			rules: [],
			roll: [
				{
					type: "guaranteed",
					drop: [
						{
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
					drop: [
						{
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
