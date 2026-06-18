import { describe, expect, it } from "vitest";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { readLiveProducerProductLineView } from "~/v0/producer/logic/readLiveProducerProductLineView";

const createLine = (overrides: Partial<ProducerProductLineView> = {}): ProducerProductLineView => ({
	durationMs: 1000,
	enabled: true,
	inProgress: true,
	inputItemIds: [],
	name: "Test product",
	productId: "test.product",
	producerQueuedJobs: 1,
	progress: 0,
	queueFull: true,
	queueSize: 1,
	queuedJobs: 1,
	requirementsReady: true,
	missingRequirementItemIds: [],
	readyAtMs: 1000,
	requirementItemIds: [],
	startedAtMs: 0,
	...overrides,
});

describe("readLiveProducerProductLineView", () => {
	it("recomputes product progress from live time", () => {
		const line = readLiveProducerProductLineView({
			line: createLine(),
			nowMs: 500,
		});

		expect(line.progress).toBe(0.5);
	});

	it("clamps completed product progress", () => {
		const line = readLiveProducerProductLineView({
			line: createLine(),
			nowMs: 1500,
		});

		expect(line.progress).toBe(1);
	});

	it("keeps idle lines unchanged", () => {
		const baseLine = createLine({
			inProgress: false,
			progress: undefined,
			readyAtMs: undefined,
			startedAtMs: undefined,
		});

		expect(
			readLiveProducerProductLineView({
				line: baseLine,
				nowMs: 500,
			}),
		).toBe(baseLine);
	});
});
