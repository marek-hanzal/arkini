import { describe, expect, it } from "vitest";

import { createAcquisitionGraphFn } from "~/flow/fn/createAcquisitionGraphFn";
import { readItemOriginSourcesFn } from "~/flow/fn/readItemOriginSourcesFn";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { existsWhen } from "~test/production-line/support/lineTestRuntime";
import { createMergeTestConfig } from "~test/item-merge/support/createMergeTestConfig";

const readItemOriginSources = (config: Parameters<typeof createAcquisitionGraphFn>[0]) =>
	readItemOriginSourcesFn(createAcquisitionGraphFn(config));

const dropOf = (itemUid: string): OutcomeSchema.Type => ({
	type: "item",
	itemUid,
	placement: "drop",
	quantity: {
		max: 1,
		min: 1,
	},
	rules: [],
});

const outputOf = (itemUid: string): OutcomeTableSchema.Type => ({
	set: [
		{
			rules: [],
			roll: [
				{
					outcome: [
						dropOf(itemUid),
					],
					type: "guaranteed",
				},
			],
			weight: 1,
		},
	],
});

describe("readItemOriginSourcesFn", () => {
	it("uses canonical route IDs, conditions, and positive-probability outputs", () => {
		const config = structuredClone(createJobTestConfig());
		const forge = config.items.forge;
		for (const itemUid of [
			"dust",
			"ingot",
			"permit",
		])
			config.items[itemUid] = {
				...config.items.tool,
				title: itemUid,
				uid: itemUid,
			};
		const line = forge.lines[0]!;
		const ingotDrop = dropOf("ingot");
		ingotDrop.rules.push({
			type: "enable",
			when: [
				existsWhen("permit"),
			],
		});
		line.outcome = {
			set: [
				{
					rules: [],
					roll: [
						{
							chance: 0,
							outcome: [
								dropOf("dust"),
							],
							type: "chance",
						},
						{
							outcome: [
								ingotDrop,
							],
							type: "guaranteed",
						},
					],
					weight: 1,
				},
			],
		};
		line.rules.push({
			type: "enable",
			when: [
				existsWhen("permit"),
			],
		});
		forge.lines.push({
			...line,
			enable: false,
			id: "line:forge:disabled",
			outcome: outputOf("dust"),
			rules: [],
		});
		const graph = createAcquisitionGraphFn(config);
		const sources = readItemOriginSourcesFn(graph);

		expect(sources).toHaveLength(1);
		expect(sources[0]?.routeIds).toEqual(graph.routes.map(({ id }) => id));
		expect(sources.flatMap(({ outputs }) => outputs.map(({ itemUid }) => itemUid))).toEqual([
			"ingot",
		]);
		expect(sources[0]).toMatchObject({
			id: JSON.stringify([
				"source",
				"forge",
				"line",
				"line:forge:run",
			]),
			outputs: [
				expect.objectContaining({
					requirements: {
						allOf: expect.arrayContaining([
							expect.objectContaining({
								itemUid: "permit",
							}),
						]),
						anyOf: [],
						unsupported: [],
					},
				}),
			],
		});
	});

	it("shares the compiler's first-match merge routes", () => {
		const config = createMergeTestConfig({
			rule: [
				{
					action: "consume",
					effect: "replace",
					result: "result",
					target: {
						itemUid: "target",
						type: "item",
					},
				},
				{
					action: "consume",
					effect: "replace",
					result: "output",
					target: {
						itemUid: "target",
						type: "item",
					},
				},
			],
		});
		const graph = createAcquisitionGraphFn(config);
		const sources = readItemOriginSourcesFn(graph);

		expect(sources).toHaveLength(1);
		expect(sources[0]?.routeIds).toEqual(graph.routes.map(({ id }) => id));
		expect(sources.flatMap(({ outputs }) => outputs.map(({ itemUid }) => itemUid))).toEqual([
			"result",
		]);
	});

	it("keeps output-specific requirement clauses on their own occurrence", () => {
		const config = structuredClone(createJobTestConfig());
		const forge = config.items.forge;
		for (const itemUid of [
			"permit-a",
			"permit-b",
			"slag",
		])
			config.items[itemUid] = {
				...config.items.tool,
				title: itemUid,
				uid: itemUid,
			};
		const conditionedDrop = (itemUid: string, permitId: string): OutcomeSchema.Type => ({
			...dropOf(itemUid),
			rules: [
				{
					type: "enable" as const,
					when: [
						existsWhen(permitId),
					],
				},
			],
		});
		forge.lines[0]!.outcome = {
			set: [
				{
					rules: [],
					roll: [
						{
							outcome: [
								conditionedDrop("ingot", "permit-a"),
								conditionedDrop("slag", "permit-b"),
							],
							type: "guaranteed",
						},
					],
					weight: 1,
				},
			],
		};

		const source = readItemOriginSources(config).find(
			({ reference }) => reference.type === "line" && reference.lineId === "line:forge:run",
		);
		const ingot = source?.outputs.find(({ itemUid }) => itemUid === "ingot");
		const slag = source?.outputs.find(({ itemUid }) => itemUid === "slag");

		expect(ingot?.requirements.allOf).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemUid: "permit-a",
					sources: [
						"output-condition",
					],
				}),
			]),
		);
		expect(ingot?.requirements.allOf).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemUid: "permit-b",
				}),
			]),
		);
		expect(slag?.requirements.allOf).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemUid: "permit-b",
					sources: [
						"output-condition",
					],
				}),
			]),
		);
		expect(slag?.requirements.allOf).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemUid: "permit-a",
				}),
			]),
		);

		const graph = createAcquisitionGraphFn(config);
		const withAlternativeClause = {
			...graph,
			routes: graph.routes.map((route) =>
				route.output.factId === "slag"
					? {
							...route,
							requirements: {
								...route.requirements,
								anyOf: [
									[
										{
											factId: "permit-a",
											quantity: 1,
											source: "output-condition" as const,
											usage: "ongoing" as const,
										},
										{
											factId: "permit-b",
											quantity: 1,
											source: "output-condition" as const,
											usage: "ongoing" as const,
										},
									],
								],
								unsupported: [
									{
										factId: "permit-a",
										reason: "upper-bound" as const,
										source: "output-condition" as const,
									},
								],
							},
						}
					: route,
			),
		};
		const alternativeSlag = readItemOriginSourcesFn(withAlternativeClause)
			.flatMap(({ outputs }) => outputs)
			.find(({ itemUid }) => itemUid === "slag");
		expect(alternativeSlag?.requirements.anyOf).toEqual([
			[
				expect.objectContaining({
					itemUid: "permit-a",
				}),
				expect.objectContaining({
					itemUid: "permit-b",
				}),
			],
		]);
		expect(alternativeSlag?.requirements.unsupported).toEqual([
			{
				itemUid: "permit-a",
				reason: "upper-bound",
				source: "output-condition",
			},
		]);
	});
});
