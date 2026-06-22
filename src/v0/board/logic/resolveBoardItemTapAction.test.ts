import { describe, expect, it } from "vitest";
import { resolveBoardItemTapAction } from "~/v0/board/logic/resolveBoardItemTapAction";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";

const baseBoardItem = (overrides: Partial<BoardViewItem> = {}): BoardViewItem => ({
	id: "board:item",
	itemId: "item:twig",
	x: 0,
	y: 0,
	state: {},
	...overrides,
});

const craft = (overrides: Partial<NonNullable<BoardViewItem["craft"]>> = {}) => ({
	acceptedInputItemIds: [],
	canAcceptInputs: false,
	complete: false,
	delivered: {},
	durationMs: 1000,
	exclusiveTo: [],
	id: "craft:twig",
	inputProgress: 1,
	inputs: [],
	phase: "waiting" as const,
	progress: 0.5,
	readyAtMs: 2000,
	remainingMs: 1000,
	resultItemId: "item:branch" as const,
	startedAtMs: 1000,
	timeProgress: 0.5,
	...overrides,
});

const activation = (
	kind: NonNullable<BoardViewItem["activation"]>["kind"],
	overrides: Partial<NonNullable<BoardViewItem["activation"]>> = {},
) => ({
	cooldownMs: undefined,
	cooldownUntil: undefined,
	cooldownUntilMs: undefined,
	inputs: [],
	kind,
	remainingCharges: undefined,
	requirements: [],
	trigger: "click" as const,
	...overrides,
});

const productLine = (isDefault: boolean, overrides = {}) => ({
	durationMs: 1000,
	enabled: true,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault,
	missingRequirementItemIds: [],
	name: "Product",
	producerQueuedJobs: 0,
	productId: "product:test",
	progress: undefined,
	queueFull: false,
	queueSize: 1,
	queuedJobs: 0,
	requirementItemIds: [],
	requirementsReady: true,
	...overrides,
});

describe("resolveBoardItemTapAction", () => {
	it("claims finished crafts before considering activation", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					activation: activation("producer"),
					craft: craft({
						complete: false,
						readyAtMs: 1000,
					}),
				}),
				nowMs: 1000,
			}),
		).toEqual({
			boardItemId: "board:item",
			type: "claim-craft",
		});
	});

	it("activates producers with explicit default product line", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					activation: activation("producer", {
						productLines: [
							productLine(true),
						],
					}),
				}),
				nowMs: 0,
			}),
		).toEqual({
			activation: "single",
			boardItemId: "board:item",
			type: "activate",
		});
	});

	it("opens detail for producers without explicit default product line", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					activation: activation("producer", {
						productLines: [
							productLine(false),
						],
					}),
				}),
				nowMs: 0,
			}),
		).toEqual({
			boardItemId: "board:item",
			type: "open-detail",
		});
	});

	it("opens detail for producers with default product line that cannot start", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					activation: activation("producer", {
						productLines: [
							productLine(true, {
								inputsAvailable: false,
								inputsReady: false,
							}),
						],
					}),
				}),
				nowMs: 0,
			}),
		).toEqual({
			boardItemId: "board:item",
			type: "open-detail",
		});
	});

	it("starts craft input collection before considering activation", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					activation: activation("producer", {
						productLines: [
							productLine(true),
						],
					}),
					craft: craft({
						phase: "collecting_inputs",
						readyAtMs: undefined,
					}),
				}),
				nowMs: 0,
			}),
		).toEqual({
			boardItemId: "board:item",
			recipeId: "craft:twig",
			type: "start-craft",
		});
	});

	it("starts partial craft auto-fill before opening detail when resources are available", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					craft: craft({
						delivered: {
							"item:water": 1,
						},
						inputProgress: 0.5,
						inputs: [
							{
								available: 1,
								itemId: "item:water" as const,
								quantity: 2,
							},
						],
						phase: "collecting_inputs",
						readyAtMs: undefined,
					}),
				}),
				nowMs: 0,
			}),
		).toEqual({
			boardItemId: "board:item",
			recipeId: "craft:twig",
			type: "start-craft",
		});
	});

	it("opens detail for partially filled crafts when no resources are available", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					craft: craft({
						delivered: {
							"item:water": 1,
						},
						inputProgress: 0.5,
						inputs: [
							{
								available: 0,
								itemId: "item:water" as const,
								quantity: 2,
							},
						],
						phase: "collecting_inputs",
						readyAtMs: undefined,
					}),
				}),
				nowMs: 0,
			}),
		).toEqual({
			boardItemId: "board:item",
			type: "open-detail",
		});
	});

	it("activates stashes with exhaust mode", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					activation: activation("stash"),
				}),
				nowMs: 0,
			}),
		).toEqual({
			activation: "exhaust",
			boardItemId: "board:item",
			type: "activate",
		});
	});

	it("opens detail for passive items", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem(),
				nowMs: 0,
			}),
		).toEqual({
			boardItemId: "board:item",
			type: "open-detail",
		});
	});

	it("opens detail for crafts with missing requirements", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					craft: craft({
						phase: "collecting_inputs",
						readyAtMs: undefined,
						requirements: [
							{
								capacity: 1,
								itemId: "item:water",
								quantity: 1,
								stored: 0,
								type: "passive",
							},
						],
					}),
				}),
				nowMs: 0,
			}),
		).toEqual({
			boardItemId: "board:item",
			type: "open-detail",
		});
	});
});
