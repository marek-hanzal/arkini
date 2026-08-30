import { describe, expect, it } from "vitest";

import { owners, runChain } from "~test/game-tick/support/queuedProducerChainTestRuntime";

describe("queued producer chain", () => {
	it.each([
		{
			name: "upstream first",
			order: [
				"A",
				"B",
				"C",
			] as const,
		},
		{
			name: "downstream first",
			order: [
				"C",
				"B",
				"A",
			] as const,
		},
	])("plays a concrete A -> B -> C chain with $name enqueue", ({ order }) => {
		const result = runChain(order);

		expect(result.queued.jobQueue.map((request) => request.ownerItemId)).toEqual(
			order.map((key) => owners[key].ownerItemId),
		);
		expect(result.settledSteps).toBeLessThan(100);
		expect(result.completed.jobs).toEqual([]);
		expect(result.completed.jobQueue).toEqual([]);
		expect(result.completed.items.filter((item) => item.item.id === "raw")).toEqual([]);
		expect(result.completed.items.filter((item) => item.item.id === "intermediate")).toEqual(
			[],
		);
		expect(
			result.completed.items
				.filter((item) => item.item.id === "final")
				.reduce((quantity, item) => quantity + item.quantity, 0),
		).toBe(1);
		expect(
			result.completed.items.some(
				(item) => item.location.scope === "job" || item.location.scope === "reserved",
			),
		).toBe(false);
	});
	it("finishes the chain in an off-screen board space without presentation settlement", () => {
		const result = runChain(
			[
				"C",
				"B",
				"A",
			],
			1,
		);

		expect(result.settledSteps).toBeLessThan(100);
		expect(result.completed.jobs).toEqual([]);
		expect(result.completed.jobQueue).toEqual([]);
		expect(result.completed.items.some((item) => item.location.scope === "delivery")).toBe(
			false,
		);
		expect(
			result.completed.items
				.filter((item) => item.item.id === "final")
				.reduce((quantity, item) => quantity + item.quantity, 0),
		).toBe(1);
	});
});
