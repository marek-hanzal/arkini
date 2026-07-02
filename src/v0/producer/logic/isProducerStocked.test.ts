import { describe, expect, it } from "vitest";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import { isProducerStocked } from "~/v0/producer/logic/isProducerStocked";

const productLine = (
	overrides: Partial<NonNullable<ActivationView["producerLines"]>[number]> = {},
) => ({
	durationMs: 1000,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault: false,
	name: "Product",
	lineKind: "product" as const,
	producerQueuedJobs: 0,
	lineId: "line:test",
	queueFull: false,
	blocked: false,
	queueSize: 1,
	queuedJobs: 0,
	...overrides,
});

const producerActivation = (
	producerLines: NonNullable<ActivationView["producerLines"]>,
): ActivationView => ({
	inputs: [],
	kind: "producer",
	producerLines,
	trigger: "click",
});

describe("isProducerStocked", () => {
	it("does not treat the first producer producer line as an implicit default", () => {
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

	it("uses only the explicit default producer producer line for stocked state", () => {
		expect(
			isProducerStocked(
				producerActivation([
					productLine({
						inputsReady: false,
						isDefault: false,
					}),
					productLine({
						isDefault: true,
						lineId: "line:default",
					}),
				]),
			),
		).toBe(true);
	});

	it("uses runnable default effects before default producer lines for stocked state", () => {
		expect(
			isProducerStocked(
				producerActivation([
					productLine({
						inputsReady: false,
						isDefault: true,
						lineKind: "product" as const,
					}),
					productLine({
						isDefault: true,
						lineKind: "effect" as const,
					}),
				]),
			),
		).toBe(true);
	});

	it("falls back to default product stocked state while the default effect is locked", () => {
		expect(
			isProducerStocked(
				producerActivation([
					productLine({
						effectLocked: true,
						isDefault: true,
						lineKind: "effect" as const,
					}),
					productLine({
						isDefault: true,
						lineKind: "product" as const,
					}),
				]),
			),
		).toBe(true);
	});

	it("treats default producer producer line with auto-fill availability as stocked", () => {
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

	it("does not treat default producer producer line blocked by queue delivery as stocked", () => {
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

	it("treats default producer producer line with partial fill availability as stocked", () => {
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
				trigger: "click",
			}),
		).toBe(false);
	});
	it("uses stash producer line run state when producer-like line views are available", () => {
		expect(
			isProducerStocked({
				inputs: [],
				kind: "stash",
				producerLines: [
					productLine({
						queueBlockedReason: "paused",
					}),
				],
				trigger: "click",
			}),
		).toBe(false);
	});
});
