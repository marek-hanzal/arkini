import { describe, expect, it } from "vitest";

import { createEditorAcquisitionGraphFn } from "~/flow/domain/fn/createEditorAcquisitionGraphFn";
import { readEditorItemOriginSourcesFn } from "~/flow/domain/fn/readEditorItemOriginSourcesFn";
import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { existsWhen } from "~test/production-line/fx/support/lineTestRuntime";
import { createMergeTestConfig } from "~test/item-merge/support/createMergeTestConfig";

const readEditorItemOriginSources = (
	config: Parameters<typeof createEditorAcquisitionGraphFn>[0],
) => readEditorItemOriginSourcesFn(createEditorAcquisitionGraphFn(config));

const dropOf = (itemId: string): DropSchema.Type => ({
	itemId,
	placement: "drop",
	quantity: {
		max: 1,
		min: 1,
	},
	rules: [],
});

const outputOf = (itemId: string): OutputSchema.Type => ({
	set: [
		{
			roll: [
				{
					drop: [
						dropOf(itemId),
					],
					type: "guaranteed",
				},
			],
			weight: 1,
		},
	],
});

describe("readEditorItemOriginSourcesFn", () => {
	it("uses canonical route IDs, conditions, and positive-probability outputs", () => {
		const config = structuredClone(createJobTestConfig());
		const forge = config.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		for (const itemId of [
			"dust",
			"ingot",
			"permit",
		])
			config.items[itemId] = {
				...config.items.tool,
				id: itemId,
				title: itemId,
				uid: itemId,
			};
		const line = forge.lines[0]!;
		const ingotDrop = dropOf("ingot");
		ingotDrop.rules.push({
			type: "enable",
			when: [
				existsWhen("permit"),
			],
		});
		line.output = {
			set: [
				{
					roll: [
						{
							chance: 0,
							drop: [
								dropOf("dust"),
							],
							type: "chance",
						},
						{
							drop: [
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
			output: outputOf("dust"),
			rules: [],
		});
		const graph = createEditorAcquisitionGraphFn(config);
		const sources = readEditorItemOriginSourcesFn(graph);

		expect(sources).toHaveLength(1);
		expect(sources[0]?.routeIds).toEqual(graph.routes.map(({ id }) => id));
		expect(sources.flatMap(({ outputs }) => outputs.map(({ itemId }) => itemId))).toEqual([
			"ingot",
		]);
		expect(sources[0]).toMatchObject({
			id: "source:forge:line:line:forge:run",
			outputs: [
				expect.objectContaining({
					requirements: {
						allOf: expect.arrayContaining([
							expect.objectContaining({
								itemId: "permit",
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
						itemId: "target",
						type: "item",
					},
				},
				{
					action: "consume",
					effect: "replace",
					result: "output",
					target: {
						itemId: "target",
						type: "item",
					},
				},
			],
		});
		const graph = createEditorAcquisitionGraphFn(config);
		const sources = readEditorItemOriginSourcesFn(graph);

		expect(sources).toHaveLength(1);
		expect(sources[0]?.routeIds).toEqual(graph.routes.map(({ id }) => id));
		expect(sources.flatMap(({ outputs }) => outputs.map(({ itemId }) => itemId))).toEqual([
			"result",
		]);
	});

	it("keeps output-specific requirement clauses on their own occurrence", () => {
		const config = structuredClone(createJobTestConfig());
		const forge = config.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		for (const itemId of [
			"permit-a",
			"permit-b",
			"slag",
		])
			config.items[itemId] = {
				...config.items.tool,
				id: itemId,
				title: itemId,
				uid: itemId,
			};
		const conditionedDrop = (itemId: string, permitId: string): DropSchema.Type => ({
			...dropOf(itemId),
			rules: [
				{
					type: "enable" as const,
					when: [
						existsWhen(permitId),
					],
				},
			],
		});
		forge.lines[0]!.output = {
			set: [
				{
					roll: [
						{
							drop: [
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

		const source = readEditorItemOriginSources(config).find(
			({ reference }) => reference.type === "line" && reference.lineId === "line:forge:run",
		);
		const ingot = source?.outputs.find(({ itemId }) => itemId === "ingot");
		const slag = source?.outputs.find(({ itemId }) => itemId === "slag");

		expect(ingot?.requirements.allOf).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "permit-a",
					sources: [
						"output-condition",
					],
				}),
			]),
		);
		expect(ingot?.requirements.allOf).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "permit-b",
				}),
			]),
		);
		expect(slag?.requirements.allOf).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "permit-b",
					sources: [
						"output-condition",
					],
				}),
			]),
		);
		expect(slag?.requirements.allOf).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "permit-a",
				}),
			]),
		);

		const graph = createEditorAcquisitionGraphFn(config);
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
		const alternativeSlag = readEditorItemOriginSourcesFn(withAlternativeClause)
			.flatMap(({ outputs }) => outputs)
			.find(({ itemId }) => itemId === "slag");
		expect(alternativeSlag?.requirements.anyOf).toEqual([
			[
				expect.objectContaining({
					itemId: "permit-a",
				}),
				expect.objectContaining({
					itemId: "permit-b",
				}),
			],
		]);
		expect(alternativeSlag?.requirements.unsupported).toEqual([
			{
				itemId: "permit-a",
				reason: "upper-bound",
				source: "output-condition",
			},
		]);
	});
});
