import { describe, expect, it } from "vitest";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import { readProducerBoardProgress } from "~/v0/producer/logic/readProducerBoardProgress";

const producerActivation = (
	productLines: ActivationView["productLines"],
	kind: ActivationView["kind"] = "producer",
): ActivationView => ({
	inputs: [],
	kind,
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
						blocked: false,
						blockReasonEffectIds: [],
						queueSize: 1,
						queuedJobs: 1,
						readyAtMs: 2000,
						requirementItemIds: [],
						requirementsReady: true,
						startAtMs: 1000,
					},
				]),
				nowMs: 1500,
			}),
		).toEqual({
			progress: 0.5,
		});
	});

	it("returns live progress for stash activations that expose producer product lines", () => {
		expect(
			readProducerBoardProgress({
				activation: producerActivation(
					[
						{
							durationMs: 1000,
							inProgress: true,
							isDefault: true,
							inputItemIds: [],
							inputs: [],
							inputsReady: true,
							inputsAvailable: true,
							missingRequirementItemIds: [],
							name: "Open",
							productId: "product:stash",
							producerQueuedJobs: 1,
							queueFull: true,
							blocked: false,
							blockReasonEffectIds: [],
							queueSize: 1,
							queuedJobs: 1,
							readyAtMs: 2000,
							requirementItemIds: [],
							requirementsReady: true,
							startAtMs: 1000,
						},
					],
					"stash",
				),
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
						blocked: false,
						blockReasonEffectIds: [],
						queueSize: 1,
						queuedJobs: 1,
						readyAtMs: 3000,
						requirementItemIds: [],
						requirementsReady: true,
						startAtMs: 2000,
					},
				]),
				nowMs: 1500,
			}),
		).toBeUndefined();
	});

	it("shows paused producer progress even after the old ready time passes", () => {
		expect(
			readProducerBoardProgress({
				activation: producerActivation([
					{
						durationMs: 1000,
						inProgress: true,
						isDefault: true,
						inputItemIds: [],
						inputs: [],
						inputsReady: true,
						inputsAvailable: true,
						missingRequirementItemIds: [],
						name: "Twig",
						pausedAtMs: 1250,
						productId: "product:twig",
						producerQueuedJobs: 1,
						queueFull: true,
						blocked: false,
						blockReasonEffectIds: [],
						queueSize: 1,
						queuedJobs: 1,
						readyAtMs: 2000,
						requirementItemIds: [],
						requirementsReady: true,
						startAtMs: 1000,
					},
				]),
				nowMs: 3000,
			}),
		).toEqual({
			progress: 0.25,
		});
	});

	it("does not show completed blocked deliveries as running progress", () => {
		expect(
			readProducerBoardProgress({
				activation: producerActivation([
					{
						durationMs: 1000,
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
						blocked: false,
						blockReasonEffectIds: [],
						queueSize: 1,
						queuedJobs: 1,
						readyAtMs: 2000,
						requirementItemIds: [],
						requirementsReady: true,
						startAtMs: 1000,
					},
				]),
				nowMs: 2500,
			}),
		).toBeUndefined();
	});
});
