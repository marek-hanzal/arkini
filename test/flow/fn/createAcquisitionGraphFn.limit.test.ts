import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createAcquisitionGraphFn } from "~/flow/fn/createAcquisitionGraphFn";
import { readItemConnectionFactsFn } from "~/flow/fn/readItemConnectionFactsFn";
import { estimateRequestsFn } from "~/estimate/fn/estimateRequestsFn";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";
import {
	createLine,
	createOutput,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";

const limit = [
	{
		type: "enable",
		when: [
			{
				type: "limit",
				itemId: "capped",
			},
		],
	},
];
const output = (
	drops: ReadonlyArray<{
		itemId: string;
		rules?: typeof limit;
	}>,
) => ({
	set: [
		{
			roll: [
				{
					type: "guaranteed",
					drop: drops.map((drop) => ({
						rules: [],
						...drop,
						quantity: {
							min: 1,
							max: 1,
						},
					})),
				},
			],
		},
	],
});
const makeConfig = (lines: unknown[], maxCount?: number) =>
	GameConfigSchema.parse({
		...editorTestConfig,
		start: {
			...editorTestConfig.start,
			board: [
				{
					itemId: "maker",
					quantity: 1,
					x: 0,
					y: 0,
					space: 0,
				},
			],
		},
		items: {
			maker: {
				...createSimpleItem("maker"),
				lines,
			},
			capped: {
				...createSimpleItem("capped"),
				maxCount,
			},
			target: createSimpleItem("target"),
			blocked: createSimpleItem("blocked"),
			"blocked-line": createSimpleItem("blocked-line"),
		},
	});

describe("Limit authored acquisition", () => {
	it("acquires the target cap once across line and drop prerequisites and retains connection origins", () => {
		const config = makeConfig(
			[
				{
					...createLine({
						id: "make-cap",
						output: createOutput([
							{
								itemId: "capped",
							},
						]),
					}),
					runtimeMs: 5,
				},
				{
					...createLine({
						id: "make-target",
					}),
					runtimeMs: 10,
					rules: limit,
					output: output([
						{
							itemId: "target",
							rules: limit,
						},
					]),
				},
			],
			3,
		);
		const graph = createAcquisitionGraphFn(config);
		const target = graph.routes.find(({ output }) => output.factId === "target");
		expect(target?.requirements.allOf.filter(({ factId }) => factId === "capped")).toEqual([
			{
				factId: "capped",
				quantity: 3,
				source: "line-condition",
				usage: "ongoing",
			},
			{
				factId: "capped",
				quantity: 3,
				source: "output-condition",
				usage: "ongoing",
			},
		]);
		expect(graph.limitations).not.toContain("spatial-requirements-approximated");
		const result = estimateRequestsFn({
			graph,
			requests: [
				{
					factId: "target",
				},
			],
		})[0];
		expect(result).toMatchObject({
			status: "complete",
			durationMs: 25,
			requirementSummary: {
				ongoing: [
					{
						factId: "capped",
						quantity: 3,
					},
				],
			},
		});
		const connection = readItemConnectionFactsFn(config, "maker", "inputs").find(
			({ itemId }) => itemId === "capped",
		);
		expect(connection?.origins).toHaveLength(2);
		expect(connection?.origins.map(({ condition }) => condition)).toEqual([
			{
				ruleIndex: 0,
				whenIndex: 0,
			},
			{
				ruleIndex: 0,
				whenIndex: 0,
			},
		]);
	});

	it("keeps uncapped Enable routes unavailable without borrowing their same-item co-output", () => {
		const config = makeConfig([
			{
				...createLine({
					id: "make-target",
				}),
				runtimeMs: 10,
				output: output([
					{
						itemId: "target",
					},
					{
						itemId: "target",
						rules: limit,
					},
					{
						itemId: "blocked",
						rules: limit,
					},
				]),
			},
			{
				...createLine({
					id: "blocked-line",
					output: createOutput([
						{
							itemId: "blocked-line",
						},
					]),
				}),
				rules: limit,
			},
		]);
		const graph = createAcquisitionGraphFn(config);
		expect(
			graph.routes.filter(({ executionConstraint }) => executionConstraint === "unavailable"),
		).toHaveLength(3);
		const results = estimateRequestsFn({
			graph,
			requests: [
				{
					factId: "target",
					quantity: 2,
				},
				{
					factId: "blocked",
				},
				{
					factId: "blocked-line",
				},
			],
		});
		expect(results[0]).toMatchObject({
			status: "complete",
			durationMs: 20,
		});
		expect(results[1]).toMatchObject({
			status: "unreachable",
			diagnostics: [
				expect.objectContaining({
					kind: "unreachable",
				}),
			],
		});
		expect(results[2]).toMatchObject({
			status: "unreachable",
			diagnostics: [
				expect.objectContaining({
					kind: "unreachable",
				}),
			],
		});
	});
});
