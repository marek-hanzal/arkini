import { describe, expect, it } from "vitest";
import type { LineView } from "~/board/view/LineViewSchema";
import { readLineRunState } from "~/producer/logic/readLineRunState";

const line = (overrides: Partial<LineView> = {}): LineView => ({
	blocked: false,
	durationMs: 1000,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault: false,
	name: "Test product",
	kind: "product" as const,
	queueUsed: 0,
	lineId: "line:test",
	queueFull: false,
	jobs: 0,
	queueMax: 2,
	...overrides,
});

describe("readLineRunState", () => {
	it("allows full ready lines", () => {
		expect(
			readLineRunState({
				line: line(),
			}),
		).toMatchObject({
			canRunAction: true,
			label: "Start",
		});
	});

	it("allows partial auto-fill lines consistently with line UI", () => {
		expect(
			readLineRunState({
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
		const running = readLineRunState({
			line: line({
				inProgress: true,
				remainingMs: 800,
			}),
		});
		const paused = readLineRunState({
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

	it("blocks hidden runtime-only lines from pretending they can run", () => {
		expect(
			readLineRunState({
				line: line({
					visible: false,
				}),
			}),
		).toMatchObject({
			canRunAction: false,
			inputAvailabilityLabel: "line hidden",
			label: "Line hidden",
			statusMetaLabel: "line hidden",
		});
	});

	it("blocks visible lines with missing effect requirements", () => {
		expect(
			readLineRunState({
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
			readLineRunState({
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
			readLineRunState({
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
			readLineRunState({
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
