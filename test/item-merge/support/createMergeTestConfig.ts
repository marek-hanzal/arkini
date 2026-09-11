import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { ChargeSchema } from "~/item-definition/schema/ChargeSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const simpleItem = ({
	charges,
	id,
	maxCount,
	maxStackSize = 10,
	merge,
	scope = "any",
}: {
	charges?: ChargeSchema.Type;
	id: string;
	maxCount?: number;
	maxStackSize?: number;
	merge?: readonly [
		MergeSchema.Type,
		...MergeSchema.Type[],
	];
	scope?: "any" | "board" | "inventory";
}) => ({
	uid: id,
	id,
	title: id,
	description: id,
	charges,
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	layer: "content",
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
	sourceCharges,
	sourceMaxCount,
	sourceMaxStackSize = 10,
	sourceScope = "any",
	targetMaxStackSize = 10,
	targetCharges,
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
	sourceCharges?: ChargeSchema.Type;
	sourceMaxCount?: number;
	sourceMaxStackSize?: number;
	sourceScope?: "any" | "board" | "inventory";
	targetMaxStackSize?: number;
	targetCharges?: ChargeSchema.Type;
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
				charges: sourceCharges,
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
				charges: targetCharges,
				id: "target",
				maxStackSize: targetMaxStackSize,
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
			weight: 1,
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
