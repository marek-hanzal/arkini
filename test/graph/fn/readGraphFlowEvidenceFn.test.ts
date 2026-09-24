import { expect, it } from "vitest";
import { compileGraphFactsFn } from "~/graph/fn/compileGraphFactsFn";
import { readGraphFlowEvidenceFn } from "~/graph/fn/readGraphFlowEvidenceFn";
import { configFn, itemFn, lineFn, outputFn, queryFn } from "./compileGraphFactsFn.test/fixtures";

it("preserves selected branch provenance, disabled and zero-chance facts, and exact scoped rules without evaluating them", () => {
	const facts = compileGraphFactsFn(
		configFn({
			owner: itemFn("owner", {
				lines: [
					lineFn("digest", {
						enable: false,
						input: [
							{
								type: "materials",
								query: queryFn("input", "close"),
								quantity: {
									min: 2,
									max: 4,
								},
								mode: "reserve",
								units: {
									cost: 3,
									from: "self",
								},
							},
						],
						rules: [
							{
								type: "runtime:adjust",
								adjustMs: -200,
								when: [
									{
										type: "count",
										count: 0,
										query: queryFn("plague", "self"),
									},
									{
										type: "range",
										min: 1,
										max: 3,
										query: queryFn("input", "near"),
									},
								],
							},
						],
						outcome: {
							set: [
								{
									weight: 7,
									rules: [
										{
											type: "enable",
											when: [
												{
													type: "exists",
													query: queryFn("plague"),
												},
											],
										},
									],
									roll: [
										{
											type: "chance",
											chance: 0,
											outcome: [
												{
													type: "item",
													itemUid: "result",
													quantity: {
														min: 1,
														max: 2,
													},
													rules: [
														{
															type: "disable",
															when: [
																{
																	type: "count",
																	count: 4,
																	query: queryFn(
																		"plague",
																		"close",
																	),
																},
															],
														},
													],
												},
											],
										},
									],
								},
								{
									...outputFn("other").set[0],
									rules: [
										{
											type: "disable",
											when: [
												{
													type: "exists",
													query: queryFn("unrelated"),
												},
											],
										},
									],
								},
							],
						},
					}),
				],
			}),
			input: itemFn("input"),
			plague: itemFn("plague", {
				title: "Plague",
			}),
			result: itemFn("result"),
			other: itemFn("other"),
			unrelated: itemFn("unrelated"),
		}),
	);
	const operation = facts.operations[0]!;
	const output = facts.edges.find(
		(edge) => edge.kind === "line-item-outcome" && edge.to === "item:result",
	)!;
	const evidence = readGraphFlowEvidenceFn(
		operation,
		output,
		"input",
		[
			"item:owner",
			"item:input",
		],
		new Map(
			facts.nodes.map((node) => [
				node.id,
				node,
			]),
		),
	);
	const text = evidence.facts.join("\n");
	expect(evidence.participants).toEqual([
		"item:owner",
		"item:input",
	]);
	expect(text).toContain("enable=false");
	expect(text).toContain(
		"input [item:input]; distance=close; ×2–4; mode=reserve; units cost=3; paid by=self",
	);
	expect(text).toContain(
		"Operation rule 1: runtime adjustment=-0.2s when ALL (Plague [item:plague]; distance=self; quantity = 0) AND (input [item:input]; distance=near; quantity in 1–3 inclusive)",
	);
	expect(text).toContain("Output set 1/2; relative weight=7");
	expect(text).toContain(
		"Output set 1 rule 1: enable when ALL (Plague [item:plague]; distance=far; quantity > 0)",
	);
	expect(text).toContain("Roll 1/1: chance; chance=0; outcome 1/1");
	expect(text).toContain("Output: result [item:result] ×1–2; placement=drop");
	expect(text).toContain(
		"Selected outcome rule 1: disable when ALL (Plague [item:plague]; distance=close; quantity = 4)",
	);
	expect(text).not.toContain("unrelated");
});
