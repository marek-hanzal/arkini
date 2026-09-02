import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readItemConnectionsFn } from "~/item-authoring/fn/readItemConnectionsFn";
import {
	createMergeTestConfig,
	guaranteedMergeOutput,
} from "~test/item-merge/support/createMergeTestConfig";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { createTemporaryLifetimeTestConfig } from "~test/temporary-item/fx/temporaryLifetime.test/createTemporaryLifetimeTestConfig";

const readIdsFn = (
	config: GameConfigSchema.Type,
	itemId: string,
	filter: "required-by" | "inputs" | "produces",
) => readItemConnectionsFn(config, itemId, filter).map(({ id }) => id);

const enableRuleFn = (itemId: string) => ({
	type: "enable" as const,
	when: [
		{
			query: {
				scope: "universe" as const,
				selector: {
					itemId,
					type: "item" as const,
				},
			},
			type: "exists" as const,
		},
	],
});

describe("readItemConnectionsFn", () => {
	it("keeps inputs from disabled outputless authored lines", () => {
		const base = createJobTestConfig();
		const forge = base.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				forge: {
					...forge,
					lines: forge.lines.map((line) => ({
						...line,
						enable: false,
						output: undefined,
						rules: [],
					})),
				},
			},
		});

		expect(readIdsFn(config, "forge", "inputs")).toEqual([
			"tool",
			"water",
		]);
		expect(readIdsFn(config, "water", "required-by")).toEqual([
			"forge",
		]);
	});

	it.each([
		"keep",
		"remove",
	] as const)("keeps both sides of an outputless %s merge", (effect) => {
		const config = createMergeTestConfig({
			rule: {
				action: "use",
				effect,
				target: {
					itemId: "target",
					type: "item",
				},
			},
		});

		expect(readIdsFn(config, "source", "inputs")).toEqual([
			"target",
		]);
		expect(readIdsFn(config, "target", "required-by")).toEqual([
			"source",
		]);
		expect(readIdsFn(config, "source", "produces")).toEqual([]);
	});

	it("reads line, merge, charge-depletion, and temporary-expiry outputs", () => {
		const base = createTemporaryLifetimeTestConfig();
		const common = base.items.blocker;
		const producer = base.items.producer;
		if (producer.type !== "producer") throw new Error("Expected producer fixture.");
		const output = guaranteedMergeOutput({
			itemId: "result",
		});
		const line = {
			...producer.lines[0],
			output,
		};
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				producer: {
					...producer,
					lines: [
						line,
					],
				},
				deposit: {
					...common,
					id: "deposit",
					uid: "deposit",
					title: "deposit",
					type: "deposit",
					lines: [
						line,
					],
				},
				blueprint: {
					...common,
					id: "blueprint",
					uid: "blueprint",
					title: "blueprint",
					type: "blueprint",
					line,
				},
				craft: {
					...common,
					id: "craft",
					uid: "craft",
					title: "craft",
					type: "craft",
					line,
				},
				stash: {
					...common,
					id: "stash",
					uid: "stash",
					title: "stash",
					type: "stash",
					line,
				},
				charged: {
					...common,
					id: "charged",
					uid: "charged",
					title: "charged",
					type: "simple",
					charges: {
						amount: 1,
						output,
					},
				},
				mergeSource: {
					...common,
					id: "mergeSource",
					uid: "mergeSource",
					title: "mergeSource",
					type: "simple",
					merge: [
						{
							action: "consume",
							effect: "replace",
							result: "cappedResult",
							target: {
								itemId: "blocker",
								type: "item",
							},
							output,
						},
					],
				},
			},
		});

		for (const ownerItemId of [
			"producer",
			"deposit",
			"blueprint",
			"craft",
			"stash",
			"charged",
			"temporaryOutput",
		])
			expect(readIdsFn(config, ownerItemId, "produces")).toEqual([
				"result",
			]);
		expect(readIdsFn(config, "mergeSource", "produces")).toEqual([
			"cappedResult",
			"result",
		]);
	});

	it("keeps positive line, output, and immediate-action conditions", () => {
		const base = createJobTestConfig();
		const forge = base.items.forge;
		const common = base.items.tool;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				forge: {
					...forge,
					lines: forge.lines.map((line) => ({
						...line,
						output: {
							set: [
								{
									roll: [
										{
											type: "guaranteed",
											drop: [
												{
													itemId: "result",
													placement: "drop",
													quantity: {
														min: 1,
														max: 1,
													},
													rules: [
														enableRuleFn("output-permit"),
													],
												},
											],
										},
									],
								},
							],
						},
						rules: [
							enableRuleFn("line-permit"),
						],
					})),
				},
				portal: {
					...common,
					id: "portal",
					uid: "portal",
					title: "portal",
					type: "space",
					space: 1,
					enable: false,
					input: [
						{
							type: "deposit",
							query: {
								distance: "far",
								scope: "board",
								selector: {
									itemId: "water",
									type: "item",
								},
							},
						},
					],
					rules: [
						enableRuleFn("line-permit"),
					],
				},
				result: {
					...common,
					id: "result",
					uid: "result",
					title: "result",
				},
				"line-permit": {
					...common,
					id: "line-permit",
					uid: "line-permit",
					title: "line-permit",
				},
				"output-permit": {
					...common,
					id: "output-permit",
					uid: "output-permit",
					title: "output-permit",
				},
			},
		});

		expect(readIdsFn(config, "forge", "inputs")).toEqual([
			"line-permit",
			"output-permit",
			"tool",
			"water",
		]);
		expect(readIdsFn(config, "portal", "inputs")).toEqual([
			"line-permit",
			"water",
		]);
		expect(readIdsFn(config, "output-permit", "required-by")).toEqual([
			"forge",
		]);
	});
});
