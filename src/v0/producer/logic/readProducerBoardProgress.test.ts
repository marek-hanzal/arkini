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
	trigger: "click",
});

type ProductLine = NonNullable<ActivationView["productLines"]>[number];

const createLine = (overrides: Partial<ProductLine> = {}): ProductLine => ({
	durationMs: 1000,
	inProgress: true,
	isDefault: true,
	inputItemIds: [],
	inputs: [],
	inputsReady: true,
	inputsAvailable: true,
	name: "Twig",
	lineKind: "product" as const,
	productId: "product:twig",
	producerQueuedJobs: 1,
	queueFull: true,
	blocked: false,
	queueSize: 1,
	queuedJobs: 1,
	readyAtMs: 2000,
	startAtMs: 1000,
	...overrides,
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
						name: "Twig",
						lineKind: "product" as const,
						productId: "product:twig",
						producerQueuedJobs: 1,
						queueFull: true,
						blocked: false,
						queueSize: 1,
						queuedJobs: 1,
						readyAtMs: 2000,
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
							name: "Open",
							lineKind: "product" as const,
							productId: "product:stash",
							producerQueuedJobs: 1,
							queueFull: true,
							blocked: false,
							queueSize: 1,
							queuedJobs: 1,
							readyAtMs: 2000,
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

	it("counts active effect progress down for board tiles", () => {
		expect(
			readProducerBoardProgress({
				activation: producerActivation([
					createLine({
						lineKind: "effect" as const,
						name: "Minor Haste",
						productId: "product:shrine-t1:minor-haste",
					}),
				]),
				nowMs: 1250,
			}),
		).toEqual({
			progress: 0.75,
		});
	});

	it("prefers active effect countdown over product progress on board tiles", () => {
		expect(
			readProducerBoardProgress({
				activation: producerActivation([
					createLine(),
					createLine({
						lineKind: "effect" as const,
						name: "Minor Haste",
						productId: "product:shrine-t1:minor-haste",
						readyAtMs: 3000,
						startAtMs: 2000,
					}),
				]),
				nowMs: 2500,
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
						name: "Twig",
						lineKind: "product" as const,
						productId: "product:twig",
						producerQueuedJobs: 1,
						queueFull: true,
						blocked: false,
						queueSize: 1,
						queuedJobs: 1,
						readyAtMs: 3000,
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
						name: "Twig",
						lineKind: "product" as const,
						pausedAtMs: 1250,
						productId: "product:twig",
						producerQueuedJobs: 1,
						queueFull: true,
						blocked: false,
						queueSize: 1,
						queuedJobs: 1,
						readyAtMs: 2000,
						startAtMs: 1000,
					},
				]),
				nowMs: 3000,
			}),
		).toEqual({
			progress: 0.25,
		});
	});

	it("ignores blocked delivery product lines even before their retry wake", () => {
		expect(
			readProducerBoardProgress({
				activation: producerActivation([
					{
						deliveryBlocked: true,
						durationMs: 1000,
						inProgress: true,
						isDefault: true,
						inputItemIds: [],
						inputs: [],
						inputsReady: true,
						inputsAvailable: true,
						name: "Twig",
						lineKind: "product" as const,
						productId: "product:twig",
						producerQueuedJobs: 1,
						queueFull: true,
						blocked: false,
						queueSize: 1,
						queuedJobs: 1,
						readyAtMs: 2000,
						startAtMs: 1000,
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
						inProgress: true,
						isDefault: true,
						inputItemIds: [],
						inputs: [],
						inputsReady: true,
						inputsAvailable: true,
						name: "Twig",
						lineKind: "product" as const,
						productId: "product:twig",
						producerQueuedJobs: 1,
						queueFull: true,
						blocked: false,
						queueSize: 1,
						queuedJobs: 1,
						readyAtMs: 2000,
						startAtMs: 1000,
					},
				]),
				nowMs: 2500,
			}),
		).toBeUndefined();
	});
});
