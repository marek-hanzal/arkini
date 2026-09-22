import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readItemConnectionsFn } from "~/item-authoring/fn/readItemConnectionsFn";
import { readItemConnectionFactsFn } from "~/flow/fn/readItemConnectionFactsFn";
import {
	createMergeTestConfig,
	guaranteedMergeOutput,
} from "~test/item-merge/support/createMergeTestConfig";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { createTemporaryLifetimeTestConfig } from "~test/item-schedule/fx/temporaryLifetime.test/createTemporaryLifetimeTestConfig";

const readIdsFn = (
	config: GameConfigSchema.Type,
	itemId: string,
	filter: "required-by" | "inputs" | "produces",
) => readItemConnectionsFn(config, itemId, filter).map(({ item }) => item.id);

const enableRuleFn = (itemId: string) => ({
	type: "enable" as const,
	when: [
		{
			query: {
				distance: "universe" as const,
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
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				forge: {
					...forge,
					lines: forge.lines.map((line) => ({
						...line,
						enable: false,
						outcome: undefined,
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

	it("reads line, merge, unit-depletion, and temporary-expiry outputs", () => {
		const base = createTemporaryLifetimeTestConfig();
		const common = base.items.blocker;
		const { lines: _lines, maxQueueSize: _queueSize, ...baseItem } = common;
		const producer = base.items.producer;
		const outcome = guaranteedMergeOutput({
			itemId: "result",
		});
		const line = {
			...producer.lines[0],
			outcome,
		};
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				producer: {
					...producer,
					clock: {
						durationMs: 1_000,
						onExpire: outcome,
					},
					lines: [
						line,
					],
				},
				blueprint: {
					...baseItem,
					id: "blueprint",
					uid: "blueprint",
					title: "blueprint",

					lines: [
						{
							...line,
						},
					],
				},
				craft: {
					...common,
					id: "craft",
					uid: "craft",
					title: "craft",

					lines: [
						line,
					],
				},
				stash: {
					...common,
					id: "stash",
					uid: "stash",
					title: "stash",

					lines: [
						line,
					],
				},
				spent: {
					...common,
					id: "spent",
					uid: "spent",
					title: "spent",

					units: {
						amount: 1,
						outcome,
					},
				},
				mergeSource: {
					...common,
					id: "mergeSource",
					uid: "mergeSource",
					title: "mergeSource",

					merge: [
						{
							action: "consume",
							effect: "replace",
							result: "cappedResult",
							target: {
								itemId: "blocker",
								type: "item",
							},
							outcome,
						},
					],
				},
			},
		});

		for (const ownerItemId of [
			"producer",
			"blueprint",
			"craft",
			"stash",
			"spent",
			"temporaryEmptyOutput",
			"temporaryOutput",
		])
			expect(readIdsFn(config, ownerItemId, "produces")).toEqual([
				"result",
			]);
		expect(readIdsFn(config, "mergeSource", "produces")).toEqual([
			"cappedResult",
			"result",
		]);
		expect(
			readItemConnectionFactsFn(config, "result", "produced-by").map(({ itemId }) => itemId),
		).toEqual([
			"blueprint",
			"craft",
			"mergeSource",
			"producer",
			"spent",
			"stash",
			"temporaryEmptyOutput",
			"temporaryOutput",
			"temporaryRandomOutput",
		]);
		expect(
			readItemConnectionFactsFn(config, "cappedResult", "produced-by").map(
				({ itemId }) => itemId,
			),
		).toEqual([
			"mergeSource",
			"temporaryCappedOutput",
		]);
		const reverseOrigins = readItemConnectionFactsFn(config, "result", "produced-by").find(
			(connection) => connection.itemId === "producer",
		)?.origins;
		expect(reverseOrigins).toEqual([
			{
				source: {
					type: "line",
					lineIndex: 0,
					title: line.title,
				},
				role: "output",
				roll: {
					setIndex: 0,
					rollIndex: 0,
					outcomeIndex: 0,
					rollType: "guaranteed",
				},
			},
			{
				source: {
					type: "expiry",
				},
				role: "output",
				roll: {
					setIndex: 0,
					rollIndex: 0,
					outcomeIndex: 0,
					rollType: "guaranteed",
				},
			},
		]);
		expect(
			readItemConnectionFactsFn(config, "producer", "produces").find(
				(connection) => connection.itemId === "result",
			)?.origins,
		).toEqual(reverseOrigins);
	});

	it("keeps positive line, outcome, and Space outcome line conditions", () => {
		const base = createJobTestConfig();
		const forge = base.items.forge;
		const common = base.items.tool;
		const { lines: _lines, maxQueueSize: _queueSize, ...baseItem } = common;
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				forge: {
					...forge,
					lines: forge.lines.map((line) => ({
						...line,
						outcome: {
							set: [
								{
									rules: [],
									roll: [
										{
											type: "guaranteed",
											outcome: [
												{
													itemId: "result",
													type: "item",
													placement: "drop",
													quantity: {
														min: 1,
														max: 1,
													},
													rules: [
														enableRuleFn("outcome-permit"),
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
					...baseItem,
					id: "portal",
					uid: "portal",
					title: "portal",

					lines: [
						{
							id: "portal-line",
							title: "Portal line",
							description: "Travel",
							default: true,
							runtimeMs: 0,
							outcome: {
								set: [
									{
										weight: 1,
										rules: [],
										roll: [
											{
												type: "guaranteed",
												outcome: [
													{
														type: "space",
														space: 1,
														rules: [],
													},
												],
											},
										],
									},
								],
							},
							input: [
								{
									type: "units",
									query: {
										distance: "far",
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
				"outcome-permit": {
					...common,
					id: "outcome-permit",
					uid: "outcome-permit",
					title: "outcome-permit",
				},
			},
		});

		expect(readIdsFn(config, "forge", "inputs")).toEqual([
			"line-permit",
			"outcome-permit",
			"tool",
			"water",
		]);
		expect(readIdsFn(config, "portal", "inputs")).toEqual([
			"line-permit",
			"water",
		]);
		expect(readIdsFn(config, "outcome-permit", "required-by")).toEqual([
			"forge",
		]);
		expect(
			readItemConnectionFactsFn(config, "outcome-permit", "produced-by").map(
				({ itemId }) => itemId,
			),
		).toEqual([]);
		expect(readItemConnectionFactsFn(config, "portal", "inputs")).toEqual([
			{
				itemId: "line-permit",
				origins: [
					{
						source: {
							type: "line",
							lineIndex: 0,
							title: "Portal line",
						},
						role: "condition",
						condition: {
							ruleIndex: 0,
							whenIndex: 0,
						},
					},
				],
			},
			{
				itemId: "water",
				origins: [
					{
						source: {
							type: "line",
							lineIndex: 0,
							title: "Portal line",
						},
						role: "input",
						inputIndex: 0,
					},
				],
			},
		]);
		expect(
			readItemConnectionFactsFn(config, "outcome-permit", "required-by")[0]?.origins,
		).toEqual(
			forge.lines.map((line, lineIndex) => ({
				source: {
					type: "line",
					lineIndex,
					title: line.title,
				},
				role: "condition",
				condition: {
					ruleIndex: 0,
					whenIndex: 0,
				},
				roll: {
					setIndex: 0,
					rollIndex: 0,
					outcomeIndex: 0,
					rollType: "guaranteed",
				},
			})),
		);
	});
});
