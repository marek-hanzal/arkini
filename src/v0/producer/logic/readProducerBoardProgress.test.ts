import { describe, expect, it } from "vitest";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import { readProducerBoardProgress } from "~/v0/producer/logic/readProducerBoardProgress";

const producerActivation = (productLines: ActivationView["productLines"]): ActivationView => ({
	inputs: [],
	kind: "producer",
	productLines,
	requirements: [],
	trigger: "click",
});

describe("readProducerBoardProgress", () => {
	it("returns live progress for the currently running producer line", () => {
		expect(
			readProducerBoardProgress({
				activation: producerActivation([
					{
						durationMs: 1000,
						enabled: true,
						inProgress: true,
						isDefault: true,
						inputItemIds: [],
						inputs: [],
						inputsReady: true,
						inputsAvailable: true,
						missingRequirementItemIds: [],
						name: "Twig",
						productId: "product:twig",
						producerQueuedJobs: 1,
						queueFull: true,
						queueSize: 1,
						queuedJobs: 1,
						readyAtMs: 2000,
						requirementItemIds: [],
						requirementsReady: true,
						startedAtMs: 1000,
					},
				]),
				nowMs: 1500,
			}),
		).toEqual({
			progress: 0.5,
		});
	});

	it("ignores future queued jobs", () => {
		expect(
			readProducerBoardProgress({
				activation: producerActivation([
					{
						durationMs: 1000,
						enabled: true,
						inProgress: true,
						isDefault: true,
						inputItemIds: [],
						inputs: [],
						inputsReady: true,
						inputsAvailable: true,
						missingRequirementItemIds: [],
						name: "Twig",
						productId: "product:twig",
						producerQueuedJobs: 1,
						queueFull: true,
						queueSize: 1,
						queuedJobs: 1,
						readyAtMs: 3000,
						requirementItemIds: [],
						requirementsReady: true,
						startedAtMs: 2000,
					},
				]),
				nowMs: 1500,
			}),
		).toBeUndefined();
	});

	it("does not show completed blocked deliveries as running progress", () => {
		expect(
			readProducerBoardProgress({
				activation: producerActivation([
					{
						durationMs: 1000,
						enabled: true,
						inProgress: true,
						isDefault: true,
						inputItemIds: [],
						inputs: [],
						inputsReady: true,
						inputsAvailable: true,
						missingRequirementItemIds: [],
						name: "Twig",
						productId: "product:twig",
						producerQueuedJobs: 1,
						queueFull: true,
						queueSize: 1,
						queuedJobs: 1,
						readyAtMs: 2000,
						requirementItemIds: [],
						requirementsReady: true,
						startedAtMs: 1000,
					},
				]),
				nowMs: 2500,
			}),
		).toBeUndefined();
	});
});
