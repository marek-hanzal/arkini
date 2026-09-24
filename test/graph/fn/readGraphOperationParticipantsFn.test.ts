import { expect, it } from "vitest";
import { compileGraphFactsFn } from "~/graph/fn/compileGraphFactsFn";
import { readGraphOperationParticipantsFn } from "~/graph/fn/readGraphOperationParticipantsFn";
import { configFn, itemFn, lineFn, outputFn, queryFn } from "./compileGraphFactsFn.test/fixtures";

it("indexes owner-only operations, exact targets, real outputs and guard references as separate roles", () => {
	const facts = compileGraphFactsFn(
		configFn({
			A: itemFn("A", {
				units: {
					amount: 3,
				},
				lines: [
					lineFn("line", {
						input: [
							{
								type: "materials",
								query: queryFn("provider"),
								quantity: {
									min: 1,
									max: 1,
								},
							},
						],
						rules: [
							{
								type: "enable",
								when: [
									{
										type: "exists",
										query: queryFn("guard"),
									},
								],
							},
						],
						outcome: outputFn("product"),
					}),
				],
				merge: [
					{
						action: "consume",
						effect: "replace",
						target: {
							type: "item",
							itemUid: "target",
						},
						result: "replacement",
					},
					{
						action: "space",
						space: 9,
						effect: "keep",
					},
				],
			}),
		}),
	);
	const participants = readGraphOperationParticipantsFn(facts);
	const rolesFn = (operationId: string) =>
		participants
			.filter((entry) => entry.operationId === operationId)
			.map(({ nodeId, role }) => `${role}:${nodeId}`)
			.sort();
	expect(
		rolesFn(
			JSON.stringify([
				"item:A",
				"depletion",
			]),
		),
	).toEqual([
		"owner:item:A",
	]);
	expect(
		rolesFn(
			JSON.stringify([
				"line",
				"line",
			]),
		),
	).toEqual([
		"input:item:provider",
		"output:item:product",
		"owner:item:A",
		"reference:item:guard",
	]);
	expect(
		rolesFn(
			JSON.stringify([
				"item:A",
				"merge",
				0,
			]),
		),
	).toEqual([
		"output:item:replacement",
		"owner:item:A",
		"target:item:target",
	]);
	expect(
		rolesFn(
			JSON.stringify([
				"item:A",
				"merge",
				1,
			]),
		),
	).toEqual([
		"output:space:9",
		"owner:item:A",
		"target:item:A",
	]);
});
