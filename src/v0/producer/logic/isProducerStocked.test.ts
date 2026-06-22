import { describe, expect, it } from "vitest";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import { isProducerStocked } from "~/v0/producer/logic/isProducerStocked";

const productLine = (
	overrides: Partial<NonNullable<ActivationView["productLines"]>[number]> = {},
) => ({
	durationMs: 1000,
	enabled: true,
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
});
