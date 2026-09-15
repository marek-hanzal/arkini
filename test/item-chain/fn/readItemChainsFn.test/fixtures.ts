import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { readItemChainsFn } from "~/item-chain/fn/readItemChainsFn";
export const outputFn = (...ids: string[]) =>
	OutputSchema.parse({
		set: [
			{
				weight: 1,
				roll: [
					{
						type: "guaranteed",
						drop: ids.map((itemId) => ({
							itemId,
							quantity: {
								min: 1,
								max: 1,
							},
							placement: "drop",
							rules: [],
						})),
					},
				],
			},
		],
	});
export const itemFn = (id: string, fields: Record<string, unknown> = {}) =>
	ItemSchema.parse({
		uid: id,
		id,
		title: id,
		artwork: {
			default: [
				id,
			],
			scale: 1,
		},
		scope: "board",
		maxStackSize: 1,
		maxQueueSize: 1,
		lines: [],
		...fields,
	});
export const mergeFn = (targetId: string, result: string) => ({
	target: {
		type: "item",
		itemId: targetId,
	},
	action: "consume",
	effect: "replace",
	result,
});
export const clockFn = (...ids: string[]) => ({
	durationMs: 1000,
	enable: true,
	rules: [],
	onExpire: outputFn(...ids),
});
export const catalogFn = (...items: ItemSchema.Type[]) =>
	Object.fromEntries(
		items.map((item) => [
			item.id,
			item,
		]),
	);
export const lineFn = (id: string, clock: boolean, output: OutputSchema.Type) => ({
	id,
	title: id,
	description: id,
	clock,
	default: false,
	show: true,
	enable: true,
	runtimeMs: 0,
	input: [
		{
			type: "simple",
		},
	],
	output,
	rules: [],
});
export const finalIdsFn = (result: readItemChainsFn.Result) =>
	result.chains.flatMap((chain) =>
		chain.outcomes
			.filter((outcome) => outcome.stop === "final")
			.map((outcome) => outcome.itemId),
	);
