import { Effect } from "effect";
import { expect, it } from "vitest";
import { compileGraphFactsFn } from "~/graph/fn/compileGraphFactsFn";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import { configFn, itemFn, lineFn } from "../fn/compileGraphFactsFn.test/fixtures";
import { projectFn } from "./createProjectGraphFx.test/fixtures";

it("preserves template-qualified Inventory recipes and distinct owner provenance through graph discovery", async () => {
	const space = {
		type: "inventory",
		templateUid: "T",
	};
	const config = configFn({
		A: itemFn("A", {
			lines: [
				lineFn("entry", {
					outcome: {
						set: [
							{
								rules: [],
								roll: [
									{
										type: "guaranteed",
										outcome: [
											{
												type: "space",
												space,
												rules: [],
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
		B: itemFn("B", {
			merge: [
				{
					action: "space",
					effect: "keep",
					space,
				},
			],
		}),
		C: itemFn("C", {
			merge: [
				{
					action: "space",
					effect: "keep",
					space: {
						type: "inventory",
						templateUid: "missing",
					},
				},
			],
		}),
	});
	const facts = compileGraphFactsFn(config);
	const recipeId = "space:inventory:T";
	expect(facts.nodes.find(({ id }) => id === recipeId)).toMatchObject({
		kind: "space",
		templateUid: "T",
		missing: false,
	});
	expect(facts.nodes.find(({ id }) => id === "space:inventory:missing")).toMatchObject({
		templateUid: "missing",
		missing: true,
	});
	expect(facts.edges.filter(({ to }) => to === recipeId)).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				from: "item:A",
				kind: "space-outcome",
				source: [
					"items",
					"A",
					"lines",
					0,
					"outcome",
					"set",
					0,
					"roll",
					0,
					"outcome",
					0,
					"space",
					"templateUid",
				],
			}),
			expect.objectContaining({
				from: "item:B",
				kind: "merge-space",
				source: [
					"items",
					"B",
					"merge",
					0,
					"space",
					"templateUid",
				],
			}),
		]),
	);
	const graph = await Effect.runPromise(createProjectGraphFx());
	const project = {
		...projectFn([]),
		config,
	};
	const operations = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "operations",
			participant: recipeId,
			role: "output",
		}),
	);
	expect(operations.operations.map(({ owner }) => owner).sort()).toEqual([
		"item:A",
		"item:B",
	]);
	expect(operations.operations.find(({ kind }) => kind === "merge")).toMatchObject({
		owner: "item:B",
		destination: recipeId,
		ownership: "receiver",
	});
	expect(operations.nodes.find(({ id }) => id === recipeId)).toMatchObject({
		templateUid: "T",
	});
	const search = await Effect.runPromise(
		graph.discoveryFx(project, {
			kind: "search",
			query: recipeId,
		}),
	);
	expect(search.nodes.find(({ id }) => id === recipeId)).toMatchObject({
		templateUid: "T",
	});
});
