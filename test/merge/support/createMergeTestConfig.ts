import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const simpleItem = ({
	id,
	maxCount,
	maxStackSize = 10,
	merge,
	scope = "any",
	tags = [],
}: {
	id: string;
	maxCount?: number;
	maxStackSize?: number;
	merge?: readonly [
		MergeSchema.Type,
		...MergeSchema.Type[],
	];
	scope?: "any" | "board" | "inventory";
	tags?: string[];
}) => ({
	id,
	title: id,
	description: id,
	asset: {
		source: [
			`asset:${id}`,
		],
	},
	tags,
	categoryId: "resource",
	scope,
	maxCount,
	maxStackSize,
	merge,
	type: "simple" as const,
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
	resultMaxCount,
	rule,
	sourceMaxCount,
	sourceMaxStackSize = 10,
	sourceScope = "any",
	targetMaxStackSize = 10,
	targetTags = [],
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
	resultMaxCount?: number;
	rule:
		| MergeSchema.Type
		| readonly [
				MergeSchema.Type,
				...MergeSchema.Type[],
		  ];
	sourceMaxCount?: number;
	sourceMaxStackSize?: number;
	sourceScope?: "any" | "board" | "inventory";
	targetMaxStackSize?: number;
	targetTags?: string[];
}) =>
	GameConfigSchema.parse({
		version: "1.0",
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
		categories: {},
		items: {
			source: simpleItem({
				id: "source",
				maxCount: sourceMaxCount,
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
				id: "target",
				maxStackSize: targetMaxStackSize,
				tags: targetTags,
			}),
			result: simpleItem({
				id: "result",
				maxCount: resultMaxCount,
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
			roll: [
				{
					type: "guaranteed",
					drop: [
						{
							itemId,
							placement,
							quantity: {
								type: "value",
								value: quantity,
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
			roll: [
				{
					type: "guaranteed",
					drop: [
						{
							itemId: "output:a",
							placement: "drop",
							quantity: {
								type: "value",
								value: 2,
							},
							rules: [],
						},
					],
				},
			],
		},
		{
			weight: 1,
			roll: [
				{
					type: "guaranteed",
					drop: [
						{
							itemId: "output:b",
							placement: "drop",
							quantity: {
								type: "value",
								value: 2,
							},
							rules: [],
						},
					],
				},
			],
		},
	],
});
