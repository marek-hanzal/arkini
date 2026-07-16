import { describe, expect, it } from "vitest";
import type { ActivationView } from "~/board/view/ActivationViewSchema";
import { isProducerStocked } from "~/producer/view/isProducerStocked";

const line = (overrides: Partial<NonNullable<ActivationView["lines"]>[number]> = {}) => ({
	durationMs: 1000,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault: false,
	name: "Product",
	kind: "product" as const,
	queueUsed: 0,
	lineId: "line:test",
	queueFull: false,
	blocked: false,
	queueMax: 1,
	jobs: 0,
	...overrides,
});

const producerActivation = (lines: NonNullable<ActivationView["lines"]>): ActivationView => ({
	inputs: [],
	kind: "producer",
	lines,
	trigger: "click",
});

describe("isProducerStocked", () => {
	it("does not treat the first line as an implicit default", () => {
		expect(
			isProducerStocked(
				producerActivation([
					line({
						isDefault: false,
					}),
				]),
			),
		).toBe(false);
	});

	it("uses only the explicit default line for stocked state", () => {
		expect(
			isProducerStocked(
				producerActivation([
					line({
						inputsReady: false,
						isDefault: false,
					}),
					line({
						isDefault: true,
						lineId: "line:default",
					}),
				]),
			),
		).toBe(true);
	});

	it("uses runnable default effects before default lines for stocked state", () => {
		expect(
			isProducerStocked(
				producerActivation([
					line({
						inputsReady: false,
						isDefault: true,
						kind: "product" as const,
					}),
					line({
						isDefault: true,
						kind: "effect" as const,
					}),
				]),
			),
		).toBe(true);
	});

	it("falls back to default product stocked state while the default effect is locked", () => {
		expect(
			isProducerStocked(
				producerActivation([
					line({
						effectLocked: true,
						isDefault: true,
						kind: "effect" as const,
					}),
					line({
						isDefault: true,
						kind: "product" as const,
					}),
				]),
			),
		).toBe(true);
	});

	it("treats default line with auto-fill availability as stocked", () => {
		expect(
			isProducerStocked(
				producerActivation([
					line({
						inputsAvailable: true,
						inputsReady: false,
						isDefault: true,
					}),
				]),
			),
		).toBe(true);
	});

	it("does not treat default line blocked by queue delivery as stocked", () => {
		expect(
			isProducerStocked(
				producerActivation([
					line({
						isDefault: true,
						queueBlockedReason: "delivery_blocked",
					}),
				]),
			),
		).toBe(false);
	});

	it("treats default line with partial fill availability as stocked", () => {
		expect(
			isProducerStocked(
				producerActivation([
					line({
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
	it("uses stash line run state when producer-like line views are available", () => {
		expect(
			isProducerStocked({
				inputs: [],
				kind: "stash",
				lines: [
					line({
						queueBlockedReason: "paused",
					}),
				],
				trigger: "click",
			}),
		).toBe(false);
	});
});
