import { describe, expect, it } from "vitest";

import { createPlannerAcquisitionGraph } from "~/editor/planner/createPlannerAcquisitionGraph";
import { readPlannerSearchScope } from "~/editor/planner/readPlannerSearchScope";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const baseItem = (id: string) => ({
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	description: id,
	id,
	maxStackSize: 10,
	scope: "any" as const,
	title: id,
	uid: id,
});

const guaranteedOutput = (itemId: string) => ({
	set: [
		{
			roll: [
				{
					drop: [
						{
							itemId,
							quantity: {
								max: 1,
								min: 1,
							},
							rules: [],
						},
					],
					type: "guaranteed" as const,
				},
			],
		},
	],
});

const chanceOutput = (itemId: string) => ({
	set: [
		{
			roll: [
				{
					chance: 0.5,
					drop: [
						{
							itemId,
							quantity: {
								max: 1,
								min: 1,
							},
							rules: [],
						},
					],
					type: "chance" as const,
				},
			],
		},
	],
});

const mixedOutput = () => ({
	set: [
		{
			roll: [
				...guaranteedOutput("mixed-target").set[0].roll,
				...chanceOutput("mixed-bonus").set[0].roll,
			],
		},
	],
});

const line = ({
	id,
	inputItemId,
	output,
}: {
	readonly id: string;
	readonly inputItemId?: string;
	readonly output: Record<string, unknown>;
}) => ({
	description: id,
	id,
	input:
		inputItemId === undefined
			? [
					{
						type: "simple" as const,
					},
				]
			: [
					{
						capacity: 1,
						mode: "consume" as const,
						quantity: {
							max: 1,
							min: 1,
						},
						selector: {
							itemId: inputItemId,
							type: "item" as const,
						},
						type: "materials" as const,
					},
				],
	output,
	rules: [],
	runtimeMs: 100,
	title: id,
});

const producer = (id: string, lines: ReadonlyArray<Record<string, unknown>>) => ({
	...baseItem(id),
	lines,
	maxQueueSize: 1,
	type: "producer" as const,
});

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:planner-search-scope",
		title: "Planner search scope",
		board: {
			height: 2,
			width: 12,
		},
		inventory: {
			height: 2,
			width: 8,
		},
	},
	start: {
		board: [
			"source-a",
			"source-b",
			"target-producer",
			"random-producer",
			"mixed-producer",
			"charged-producer",
			"temporary-token",
			"merge-target",
		].map((itemId, x) => ({
			itemId,
			space: 0,
			x,
			y: 0,
		})),
		currentSpace: 0,
		inventory: [
			{
				itemId: "raw",
				quantity: 1,
			},
			{
				itemId: "merge-source",
				quantity: 1,
			},
		],
	},
	items: {
		hero: {
			...baseItem("hero"),
			type: "simple",
		},
		raw: {
			...baseItem("raw"),
			type: "simple",
		},
		"source-a": producer("source-a", [
			line({
				id: "line:source-a",
				inputItemId: "raw",
				output: guaranteedOutput("part"),
			}),
		]),
		"source-b": producer("source-b", [
			line({
				id: "line:source-b",
				inputItemId: "raw",
				output: guaranteedOutput("part"),
			}),
		]),
		part: {
			...baseItem("part"),
			type: "simple",
		},
		"target-producer": producer("target-producer", [
			line({
				id: "line:target",
				inputItemId: "part",
				output: guaranteedOutput("target"),
			}),
		]),
		target: {
			...baseItem("target"),
			type: "simple",
		},
		"random-producer": producer("random-producer", [
			line({
				id: "line:random",
				output: chanceOutput("random-target"),
			}),
		]),
		"random-target": {
			...baseItem("random-target"),
			type: "simple",
		},
		"mixed-producer": producer("mixed-producer", [
			line({
				id: "line:mixed",
				output: mixedOutput(),
			}),
		]),
		"mixed-target": {
			...baseItem("mixed-target"),
			type: "simple",
		},
		"mixed-bonus": {
			...baseItem("mixed-bonus"),
			type: "simple",
		},
		"charged-producer": {
			...producer("charged-producer", [
				{
					...line({
						id: "line:charged",
						output: guaranteedOutput("charged-side-output"),
					}),
					input: [
						{
							charges: {
								cost: 1,
								from: "self",
							},
							type: "simple",
						},
					],
				},
			]),
			charges: {
				amount: 1,
				output: guaranteedOutput("depleted-target"),
			},
		},
		"charged-side-output": {
			...baseItem("charged-side-output"),
			type: "simple",
		},
		"depleted-target": {
			...baseItem("depleted-target"),
			type: "simple",
		},
		"temporary-token": {
			...baseItem("temporary-token"),
			durationMs: 500,
			maxStackSize: 1,
			output: guaranteedOutput("temporary-target"),
			scope: "board",
			type: "temporary",
		},
		"temporary-target": {
			...baseItem("temporary-target"),
			type: "simple",
		},
		"merge-source": {
			...baseItem("merge-source"),
			merge: [
				{
					action: "consume",
					effect: "replace",
					result: "merge-result",
					target: {
						itemId: "merge-target",
						type: "item",
					},
				},
			],
			type: "simple",
		},
		"merge-target": {
			...baseItem("merge-target"),
			type: "simple",
		},
		"merge-result": {
			...baseItem("merge-result"),
			type: "simple",
		},
	},
});

const graph = createPlannerAcquisitionGraph(config);

describe("readPlannerSearchScope", () => {
	it("builds a deterministic target slice with every supported alternative", () => {
		const scope = readPlannerSearchScope({
			graph,
			targetItemId: "target",
		});

		expect(scope.supported).toBe(true);
		expect(
			scope.actions.map(({ action, depth }) => ({
				action,
				depth,
			})),
		).toEqual([
			{
				action: {
					kind: "line",
					lineId: "line:source-a",
					ownerItemId: "source-a",
				},
				depth: 1,
			},
			{
				action: {
					kind: "line",
					lineId: "line:source-b",
					ownerItemId: "source-b",
				},
				depth: 1,
			},
			{
				action: {
					kind: "line",
					lineId: "line:target",
					ownerItemId: "target-producer",
				},
				depth: 2,
			},
		]);
		expect(scope.itemIds).toEqual([
			"part",
			"raw",
			"source-a",
			"source-b",
			"target",
			"target-producer",
		]);
		expect(scope.unsupportedRoutes).toEqual([]);
	});

	it("rejects an entire action when a sibling output is stochastic", () => {
		const scope = readPlannerSearchScope({
			graph,
			targetItemId: "mixed-target",
		});

		expect(scope.supported).toBe(false);
		expect(scope.actions).toEqual([]);
		expect(scope.unsupportedRoutes).toEqual([
			expect.objectContaining({
				outputItemId: "mixed-target",
				reason: "stochastic-output",
			}),
		]);
	});

	it("keeps deterministic merge transitions inside the supported slice", () => {
		const scope = readPlannerSearchScope({
			graph,
			targetItemId: "merge-result",
		});

		expect(scope.supported).toBe(true);
		expect(scope.actions).toHaveLength(1);
		expect(scope.actions[0]?.action).toEqual({
			kind: "merge",
			mergeIndex: 0,
			sourceItemId: "merge-source",
			targetItemId: "merge-target",
		});
	});

	it.each([
		[
			"random-target",
			"stochastic-output",
		],
		[
			"depleted-target",
			"charge-depletion",
		],
		[
			"temporary-target",
			"temporary-expiry",
		],
	] as const)("marks %s as unsupported instead of unreachable", (targetItemId, reason) => {
		const scope = readPlannerSearchScope({
			graph,
			targetItemId,
		});

		expect(scope.supported).toBe(false);
		expect(scope.actions).toEqual([]);
		expect(scope.unsupportedRoutes).toEqual([
			expect.objectContaining({
				outputItemId: targetItemId,
				reason,
			}),
		]);
	});
});
