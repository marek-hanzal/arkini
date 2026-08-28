import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorEstimateComponentIndexFx } from "~/editor/estimator/createEditorEstimateComponentIndexFx";

describe("createEditorEstimateComponentIndexFx", () => {
	it("keeps component identity and seeded projection independent of insertion order", () => {
		const factIds = [
			"cycle-z",
			"self",
			"dag-b",
			"disconnected",
			"cycle-a",
			"dag-a",
		];
		const dependencyEdges = [
			[
				"cycle-z",
				"cycle-a",
			],
			[
				"dag-a",
				"dag-b",
			],
			[
				"self",
				"self",
			],
			[
				"cycle-a",
				"cycle-z",
			],
		] as const;
		const rootFactIds = new Set([
			"cycle-z",
			"dag-b",
			"self",
		]);
		const readIndex = (
			orderedFactIds: ReadonlyArray<string>,
			orderedEdges: ReadonlyArray<
				readonly [
					string,
					string,
				]
			>,
		) =>
			Effect.runSync(
				createEditorEstimateComponentIndexFx({
					dependencyEdges: orderedEdges,
					factIds: orderedFactIds,
					rootFactIds,
				}),
			);

		const expectedComponentEntries = [
			[
				"cycle-a",
				"cycle-a",
			],
			[
				"cycle-z",
				"cycle-a",
			],
			[
				"dag-a",
				"dag-a",
			],
			[
				"dag-b",
				"dag-b",
			],
			[
				"disconnected",
				"disconnected",
			],
			[
				"self",
				"self",
			],
		];
		const expectedSeededEntries = [
			[
				"cycle-a",
				"cycle-a",
			],
			[
				"cycle-z",
				"cycle-a",
			],
			[
				"dag-b",
				"dag-b",
			],
			[
				"self",
				"self",
			],
		];
		const forward = readIndex(factIds, dependencyEdges);
		const reversed = readIndex(
			[
				...factIds,
			].reverse(),
			[
				...dependencyEdges,
			].reverse(),
		);

		expect([
			...forward.componentByFact,
		]).toEqual(expectedComponentEntries);
		expect([
			...forward.seededComponentByFact,
		]).toEqual(expectedSeededEntries);
		expect([
			...reversed.componentByFact,
		]).toEqual(expectedComponentEntries);
		expect([
			...reversed.seededComponentByFact,
		]).toEqual(expectedSeededEntries);
	});
});
