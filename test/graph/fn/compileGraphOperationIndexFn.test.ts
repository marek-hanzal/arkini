import { expect, it } from "vitest";
import { compileGraphFactsFn } from "~/graph/fn/compileGraphFactsFn";
import { compileGraphOperationIndexFn } from "~/graph/fn/compileGraphOperationIndexFn";
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
	const participants = compileGraphOperationIndexFn(facts).participants;
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

it("keeps parallel authored roles while sharing one whole operation and each possible output occurrence", () => {
	const input = {
		type: "materials",
		query: queryFn("provider"),
		mode: "consume",
		quantity: {
			min: 1,
			max: 1,
		},
	};
	const index = compileGraphOperationIndexFn(
		compileGraphFactsFn(
			configFn({
				owner: itemFn("owner", {
					lines: [
						lineFn("active", {
							input: [
								input,
								input,
							],
							outcome: outputFn("product"),
						}),
						lineFn("disabled", {
							enable: false,
							outcome: outputFn("product"),
						}),
						lineFn("outputless"),
					],
				}),
				provider: itemFn("provider"),
				product: itemFn("product"),
			}),
		),
	);
	const active = index.operations.find(
		({ operation }) => operation.kind === "line" && operation.data.uid === "active",
	)!;
	const disabled = index.operations.find(
		({ operation }) => operation.kind === "line" && operation.data.uid === "disabled",
	)!;
	const outputless = index.operations.find(
		({ operation }) => operation.kind === "line" && operation.data.uid === "outputless",
	)!;
	const inputs = index.participants.filter(
		(entry) => entry.operationId === active.operation.id && entry.role === "input",
	);
	expect(inputs).toHaveLength(2);
	expect(new Set(inputs.map((entry) => entry.edgeId)).size).toBe(2);
	expect(active.required).toEqual([
		{
			node: "item:owner",
			role: "owner",
			effect: "preserved",
		},
		{
			node: "item:provider",
			role: "input",
			effect: "consumed",
		},
	]);
	expect(active.outputs).toHaveLength(1);
	expect(index.outgoing.get("item:owner")).toEqual([
		active,
	]);
	expect(index.outgoing.get("item:provider")?.[0]).toBe(active);
	expect(disabled.outputs).toEqual([]);
	expect(outputless.outputs).toEqual([]);
	expect(
		index.participants
			.filter((entry) => entry.operationId === disabled.operation.id)
			.map((entry) => entry.role),
	).toEqual([
		"owner",
		"output",
	]);
	expect(
		index.participants
			.filter((entry) => entry.operationId === outputless.operation.id)
			.map((entry) => entry.role),
	).toEqual([
		"owner",
	]);
});
