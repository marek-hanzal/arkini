import { describe, expect, it } from "vitest";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import { isProducerStocked } from "~/v0/producer/logic/isProducerStocked";

const productLine = (
	overrides: Partial<NonNullable<ActivationView["productLines"]>[number]> = {},
) => ({
	durationMs: 1000,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault: false,
	missingRequirementItemIds: [],
	name: "Product",
	producerQueuedJobs: 0,
	productId: "product:test",
	queueFull: false,
	blocked: false,
	blockReasonEffectIds: [],
	queueSize: 1,
	queuedJobs: 0,
	requirementItemIds: [],
	requirementsReady: true,
	...overrides,
});

const producerActivation = (
	productLines: NonNullable<ActivationView["productLines"]>,
): ActivationView => ({
	inputs: [],
	kind: "producer",
	productLines,
	requirements: [],
	trigger: "click",
});

describe("isProducerStocked", () => {
	it("does not treat the first producer product line as an implicit default", () => {
		expect(
			isProducerStocked(
				producerActivation([
					productLine({
						isDefault: false,
					}),
				]),
			),
		).toBe(false);
	});

	it("uses only the explicit default producer product line for stocked state", () => {
		expect(
			isProducerStocked(
				producerActivation([
					productLine({
						inputsReady: false,
						isDefault: false,
					}),
					productLine({
						isDefault: true,
						productId: "product:default",
					}),
				]),
			),
		).toBe(true);
	});

	it("treats default producer product line with auto-fill availability as stocked", () => {
		expect(
			isProducerStocked(
				producerActivation([
					productLine({
						inputsAvailable: true,
						inputsReady: false,
						isDefault: true,
					}),
				]),
			),
		).toBe(true);
	});

	it("does not treat default producer product line blocked by queue delivery as stocked", () => {
		expect(
			isProducerStocked(
				producerActivation([
					productLine({
						isDefault: true,
						queueBlockedReason: "delivery_blocked",
					}),
				]),
			),
		).toBe(false);
	});

	it("treats default producer product line with partial fill availability as stocked", () => {
		expect(
			isProducerStocked(
				producerActivation([
					productLine({
						inputs: [
							{
								available: 1,
								capacity: 2,
								consume: true,
								itemId: "item:twig",
								quantity: 2,
								stored: 0,
							},
						],
						inputsAvailable: false,
						inputsReady: false,
						isDefault: true,
					}),
				]),
			),
		).toBe(true);
	});

	it("treats stash inputs with auto-fill availability as stocked", () => {
		expect(
			isProducerStocked({
				inputs: [
					{
						available: 1,
						capacity: 1,
						consume: true,
						itemId: "item:key",
						quantity: 1,
						stored: 0,
					},
				],
				kind: "stash",
				requirements: [],
				trigger: "click",
			}),
		).toBe(true);
	});

	it("treats stash inputs without auto-fill availability as missing", () => {
		expect(
			isProducerStocked({
				inputs: [
					{
						available: 0,
						capacity: 1,
						consume: true,
						itemId: "item:key",
						quantity: 1,
						stored: 0,
					},
				],
				kind: "stash",
				requirements: [],
				trigger: "click",
			}),
		).toBe(false);
	});
});
