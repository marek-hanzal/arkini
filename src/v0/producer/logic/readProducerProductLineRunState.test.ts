import { describe, expect, it } from "vitest";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { readProducerProductLineRunState } from "~/v0/producer/logic/readProducerProductLineRunState";

const line = (overrides: Partial<ProducerProductLineView> = {}): ProducerProductLineView => ({
	blocked: false,
	durationMs: 1000,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault: false,
	name: "Test product",
	lineKind: "product" as const,
	producerQueuedJobs: 0,
	productId: "product:test",
	queueFull: false,
	queuedJobs: 0,
	queueSize: 2,
	...overrides,
});

describe("readProducerProductLineRunState", () => {
	it("allows full ready lines", () => {
		expect(
			readProducerProductLineRunState({
				line: line(),
			}),
		).toMatchObject({
			canRunAction: true,
			label: "Start",
		});
	});

	it("allows partial auto-fill lines consistently with product-line UI", () => {
		expect(
			readProducerProductLineRunState({
				line: line({
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
				}),
			}),
		).toMatchObject({
			canRunAction: true,
			inputsPartiallyAvailable: true,
			label: "Partial fill",
		});
	});

	it("reports active progress state without autonomous button timing", () => {
		const running = readProducerProductLineRunState({
			line: line({
				inProgress: true,
				remainingMs: 800,
			}),
		});
		const paused = readProducerProductLineRunState({
			line: line({
				inProgress: true,
				pausedAtMs: 200,
				remainingMs: 800,
			}),
		});

		expect(running).toMatchObject({
			showProgress: true,
		});
		expect(running).not.toHaveProperty("progressAutoCompleteMs");
		expect(paused).toMatchObject({
			showProgress: true,
		});
		expect(paused).not.toHaveProperty("progressAutoCompleteMs");
	});

	it("blocks visible lines with missing effect requirements", () => {
		expect(
			readProducerProductLineRunState({
				line: line({
					effectRequirements: [
						{
							label: "Nearby Tree",
							ready: false,
						},
					],
					startRequirementsReady: false,
				}),
			}),
		).toMatchObject({
			canRunAction: false,
			inputAvailabilityLabel: "requirements missing",
			label: "Requirements missing",
			statusMetaLabel: "requirements missing",
		});
	});

	it("blocks every line while the producer queue is waiting for delivery", () => {
		expect(
			readProducerProductLineRunState({
				line: line({
					queueBlockedReason: "delivery_blocked",
				}),
			}),
		).toMatchObject({
			canRunAction: false,
			label: "Delivery blocked",
		});
	});

	it("blocks every line while the producer queue is paused", () => {
		expect(
			readProducerProductLineRunState({
				line: line({
					queueBlockedReason: "paused",
				}),
			}),
		).toMatchObject({
			canRunAction: false,
			label: "Queue paused",
		});
	});

	it("blocks lines whose visible drops are all disabled", () => {
		expect(
			readProducerProductLineRunState({
				line: line({
					outputs: [
						{
							enabled: false,
							itemId: "item:twig",
							kind: "guaranteed",
							ownedQuantity: 0,
							quantity: 1,
						},
					],
				}),
			}),
		).toMatchObject({
			canRunAction: false,
			inputAvailabilityLabel: "drops disabled",
			label: "Drops disabled",
			statusMetaLabel: "drops disabled",
		});
	});
});
