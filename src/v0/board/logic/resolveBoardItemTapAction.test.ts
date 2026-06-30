import { describe, expect, it } from "vitest";
import { resolveBoardItemTapAction } from "~/v0/board/logic/resolveBoardItemTapAction";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import {
	cheatBoardItemId,
	inventoryBoardItemId,
	nukeSaveBoardItemId,
} from "~/v0/board/BoardUtilityItem";
import {
	cheatSpeedDisableItemId,
	cheatSpeedEnableItemId,
} from "~/v0/game/cheat/GameCheatSpeedItem";

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
	id: "craft:twig",
	inputProgress: 1,
	inputs: [],
	phase: "waiting" as const,
	progress: 0.5,
	readyAtMs: 2000,
	remainingMs: 1000,
	resultItemId: "item:branch" as const,
	startAtMs: 1000,
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
	trigger: "click" as const,
	...overrides,
});

const productLine = (isDefault: boolean, overrides = {}) => ({
	durationMs: 1000,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault,
	name: "Product",
	lineKind: "product" as const,
	producerQueuedJobs: 0,
	productId: "product:test",
	progress: undefined,
	queueFull: false,
	blocked: false,
	queueSize: 1,
	queuedJobs: 0,
	...overrides,
});

describe("resolveBoardItemTapAction", () => {
	it("opens inventory for the dedicated inventory board item", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					itemId: inventoryBoardItemId,
				}),
				nowMs: 0,
			}),
		).toEqual({
			sheet: {
				type: "inventory",
			},
			type: "open-sheet",
		});
	});

	it("opens cheat inventory for the dedicated cheat board item", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					itemId: cheatBoardItemId,
				}),
				nowMs: 0,
			}),
		).toEqual({
			sheet: {
				type: "cheat-inventory",
			},
			type: "open-sheet",
		});
	});

	it("opens save nuke confirmation for the dedicated nuke board item", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					itemId: nukeSaveBoardItemId,
				}),
				nowMs: 0,
			}),
		).toEqual({
			sheet: {
				type: "nuke-save",
			},
			type: "open-sheet",
		});
	});

	it("toggles cheat speed items without opening detail", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					itemId: cheatSpeedEnableItemId,
				}),
				nowMs: 0,
			}),
		).toEqual({
			mode: "normal",
			type: "set-cheat-speed-mode",
		});

		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					itemId: cheatSpeedDisableItemId,
				}),
				nowMs: 0,
			}),
		).toEqual({
			mode: "instant",
			type: "set-cheat-speed-mode",
		});
	});

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
			productId: "product:test",
			type: "activate",
		});
	});

	it("activates default effect lines before default product lines", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					activation: activation("producer", {
						productLines: [
							productLine(true, {
								lineKind: "product" as const,
								productId: "product:normal",
							}),
							productLine(true, {
								lineKind: "effect" as const,
								productId: "product:effect",
							}),
						],
					}),
				}),
				nowMs: 0,
			}),
		).toEqual({
			activation: "single",
			boardItemId: "board:item",
			productId: "product:effect",
			type: "activate",
		});
	});

	it("falls back to the default product line while the default effect is active", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					activation: activation("producer", {
						productLines: [
							productLine(true, {
								effectLocked: true,
								lineKind: "effect" as const,
								productId: "product:effect",
							}),
							productLine(true, {
								lineKind: "product" as const,
								productId: "product:normal",
							}),
						],
					}),
				}),
				nowMs: 0,
			}),
		).toEqual({
			activation: "single",
			boardItemId: "board:item",
			productId: "product:normal",
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
			sheet: {
				boardItemId: "board:item",
				type: "item",
			},
			type: "open-sheet",
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
			sheet: {
				boardItemId: "board:item",
				type: "item",
			},
			type: "open-sheet",
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
			sheet: {
				boardItemId: "board:item",
				type: "item",
			},
			type: "open-sheet",
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

	it("auto-activates stashes when inputs are available", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					activation: activation("stash", {
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
					}),
				}),
				nowMs: 0,
			}),
		).toEqual({
			activation: "exhaust",
			boardItemId: "board:item",
			type: "activate",
		});
	});

	it("auto-activates stashes when inputs can be partially filled", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					activation: activation("stash", {
						inputs: [
							{
								available: 1,
								capacity: 2,
								consume: true,
								itemId: "item:key",
								quantity: 2,
								stored: 0,
							},
						],
					}),
				}),
				nowMs: 0,
			}),
		).toEqual({
			activation: "exhaust",
			boardItemId: "board:item",
			type: "activate",
		});
	});

	it("opens detail for stashes whose producer-like line is queue blocked", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					activation: activation("stash", {
						productLines: [
							productLine(false, {
								queueBlockedReason: "delivery_blocked",
							}),
						],
					}),
				}),
				nowMs: 0,
			}),
		).toEqual({
			sheet: {
				boardItemId: "board:item",
				type: "item",
			},
			type: "open-sheet",
		});
	});

	it("opens detail for stashes with missing inputs", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					activation: activation("stash", {
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
					}),
				}),
				nowMs: 0,
			}),
		).toEqual({
			sheet: {
				boardItemId: "board:item",
				type: "item",
			},
			type: "open-sheet",
		});
	});

	it("opens detail for blocked craft delivery instead of claiming it", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					craft: craft({
						complete: false,
						deliveryBlocked: true,
						phase: "delivery_blocked",
						progress: 0,
						readyAtMs: 1000,
						timeProgress: 1,
					}),
				}),
				nowMs: 1500,
			}),
		).toEqual({
			sheet: {
				boardItemId: "board:item",
				type: "item",
			},
			type: "open-sheet",
		});
	});

	it("opens detail for passive items", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem(),
				nowMs: 0,
			}),
		).toEqual({
			sheet: {
				boardItemId: "board:item",
				type: "item",
			},
			type: "open-sheet",
		});
	});

	it("opens detail for crafts with missing grants", () => {
		expect(
			resolveBoardItemTapAction({
				boardItem: baseBoardItem({
					craft: craft({
						startRequirementsReady: false,
						phase: "collecting_inputs",
						readyAtMs: undefined,
					}),
				}),
				nowMs: 0,
			}),
		).toEqual({
			sheet: {
				boardItemId: "board:item",
				type: "item",
			},
			type: "open-sheet",
		});
	});
});
