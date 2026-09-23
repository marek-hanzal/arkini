import { Effect } from "effect";
import { expect, it } from "vitest";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import { projectFn } from "./createProjectGraphFx.test/fixtures";
import { configFn, itemFn, lineFn } from "../fn/compileGraphFactsFn.test/fixtures";

it("keeps mutually exclusive branches grouped through a portal and a template rather than combining them", async () => {
	const config = configFn(
		{
			A: itemFn("A", {
				lines: [
					lineFn("produce", {
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
													type: "item",
													itemUid: "portal",
													quantity: {
														min: 1,
														max: 1,
													},
													rules: [],
												},
											],
										},
									],
								},
								{
									weight: 9,
									rules: [],
									roll: [
										{
											type: "chance",
											chance: 0.25,
											outcome: [
												{
													type: "template",
													templateUid: "remote",
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
			portal: itemFn("portal", {
				merge: [
					{
						action: "consume",
						effect: "keep",
						target: {
							type: "item",
							itemUid: "A",
						},
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
													space: 7,
													rules: [],
												},
											],
										},
									],
								},
							],
						},
					},
				],
			}),
			B: itemFn("B"),
			C: itemFn("C"),
			D: itemFn("D"),
		},
		{
			templates: [
				{
					uid: "local",
					title: "Local",
					width: 1,
					height: 1,
					board: [
						{
							itemUid: "A",
							x: 0,
							y: 0,
						},
					],
				},
				{
					uid: "remote",
					title: "Remote",
					width: 1,
					height: 1,
					board: [
						{
							itemUid: "B",
							x: 0,
							y: 0,
						},
					],
				},
				{
					uid: "portal-space",
					title: "Portal space",
					width: 1,
					height: 1,
					board: [
						{
							itemUid: "C",
							x: 0,
							y: 0,
						},
					],
				},
				{
					uid: "isolated",
					title: "Isolated",
					width: 1,
					height: 1,
					board: [
						{
							itemUid: "D",
							x: 0,
							y: 0,
						},
					],
				},
			],
			start: {
				currentSpace: 0,
				spaces: [
					{
						space: 0,
						templateUid: "local",
					},
					{
						space: 7,
						templateUid: "portal-space",
					},
					{
						space: 8,
						templateUid: "isolated",
					},
				],
			},
		},
	);
	const project = {
		...projectFn(
			[],
			[
				"A",
			],
		),
		config,
	};
	const graph = await Effect.runPromise(createProjectGraphFx());
	const result = await Effect.runPromise(
		graph.queryFx(project, {
			kind: "traverse",
			from: "space:0",
			maxDepth: 8,
		}),
	);
	expect(result.nodes.map((node) => node.id)).toEqual(
		expect.arrayContaining([
			"item:B",
			"item:C",
		]),
	);
	expect(result.nodes.some((node) => node.id === "item:D")).toBe(false);
	const branchEdges = result.edges.filter(
		(edge) => edge.kind === "line-item-outcome" || edge.kind === "template-outcome",
	);
	expect(
		branchEdges.map((edge) => [
			edge.to,
			edge.annotations.setIndex,
			edge.annotations.setWeight,
			edge.annotations.alternative,
			edge.annotations.chance,
		]),
	).toEqual([
		[
			"item:portal",
			0,
			1,
			true,
			undefined,
		],
		[
			"template:remote",
			1,
			9,
			true,
			0.25,
		],
	]);
	expect(new Set(branchEdges.map((edge) => edge.annotations.setId)).size).toBe(2);
	const portalPath = await Effect.runPromise(
		graph.queryFx(project, {
			kind: "path",
			from: "item:A",
			to: "item:C",
			maxDepth: 5,
		}),
	);
	expect(portalPath.paths[0].nodes).toEqual([
		"item:A",
		"item:portal",
		"space:7",
		"template:portal-space",
		"item:C",
	]);
});
