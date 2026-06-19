import { describe, expect, it } from "vitest";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { defaultGameConfig } from "~/v0/game/compiled/defaultGameConfig";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { resolveDropIntent } from "~/v0/merge/resolveDropIntent";

const config = createEngineTestConfig();

const boardItem = (props: Omit<BoardViewItem, "state" | "x" | "y">): BoardViewItem => ({
	...props,
	state: {},
	x: 0,
	y: 0,
});

const activationTarget = (activation: NonNullable<BoardViewItem["activation"]>): BoardViewItem =>
	boardItem({
		activation,
		id: "target",
		itemId: "item:lumber-camp-1",
	});

const productLine = (
	overrides: Partial<ProducerProductLineView> = {},
): ProducerProductLineView => ({
	durationMs: 1000,
	enabled: true,
	inProgress: false,
	isDefault: true,
	inputItemIds: [],
	inputs: [],
	inputsReady: true,
	missingRequirementItemIds: [],
	name: "Test product",
	producerQueuedJobs: 0,
	productId: "product:test",
	progress: undefined,
	queueFull: false,
	queuedJobs: 0,
	queueSize: 1,
	requirementItemIds: [],
	requirementsReady: true,
	...overrides,
});

describe("resolveDropIntent", () => {
	it("uses only source-owned explicit merge rules", () => {
		expect(
			resolveDropIntent({
				config: defaultGameConfig,
				sourceItemId: "item:water",
				targetItem: boardItem({
					id: "target",
					itemId: "item:twig",
				}),
			}),
		).toEqual({
			directed: false,
			resultItemId: "item:sprout",
			type: "merge",
		});

		expect(
			resolveDropIntent({
				config: defaultGameConfig,
				sourceItemId: "item:twig",
				targetItem: boardItem({
					id: "target",
					itemId: "item:water",
				}),
			}),
		).toEqual({
			type: "swap",
		});
	});
	it("keeps regular merge as the first merge-like board interaction", () => {
		expect(
			resolveDropIntent({
				config,
				sourceItemId: "item:twig",
				targetItem: boardItem({
					id: "target",
					itemId: "item:twig",
				}),
			}),
		).toEqual({
			directed: false,
			resultItemId: "item:plank",
			type: "merge",
		});
	});

	it("routes a missing stored requirement before consumable activation inputs", () => {
		expect(
			resolveDropIntent({
				config,
				sourceItemId: "item:twig",
				targetItem: activationTarget({
					inputs: [],
					kind: "producer",
					productLines: [
						productLine({
							inputs: [
								{
									capacity: 1,
									itemId: "item:twig",
									quantity: 1,
									consume: true,
									stored: 0,
								},
							],
						}),
					],
					requirements: [
						{
							capacity: 1,
							itemId: "item:twig",
							quantity: 1,
							stored: 0,
							type: "stored",
						},
					],
					trigger: "click",
				}),
			}),
		).toEqual({
			type: "stored-requirement",
		});
	});

	it("falls through to consumable activation inputs after the stored requirement is full", () => {
		expect(
			resolveDropIntent({
				config,
				sourceItemId: "item:twig",
				targetItem: activationTarget({
					inputs: [],
					kind: "producer",
					productLines: [
						productLine({
							inputs: [
								{
									capacity: 1,
									itemId: "item:twig",
									quantity: 1,
									consume: true,
									stored: 0,
								},
							],
						}),
					],
					requirements: [
						{
							capacity: 1,
							itemId: "item:twig",
							quantity: 1,
							stored: 1,
							type: "stored",
						},
					],
					trigger: "click",
				}),
			}),
		).toEqual({
			type: "producer-input",
		});
	});

	it("routes product-line missing requirements as stored requirements", () => {
		expect(
			resolveDropIntent({
				config,
				sourceItemId: "item:twig",
				targetItem: activationTarget({
					inputs: [],
					kind: "producer",
					productLines: [
						productLine({
							missingRequirementItemIds: [
								"item:twig",
							],
							requirementItemIds: [
								"item:twig",
							],
							requirementsReady: false,
						}),
					],
					requirements: [],
					trigger: "click",
				}),
			}),
		).toEqual({
			type: "stored-requirement",
		});
	});

	it("ignores disabled product-line missing requirements", () => {
		expect(
			resolveDropIntent({
				config,
				sourceItemId: "item:twig",
				targetItem: activationTarget({
					inputs: [],
					kind: "producer",
					productLines: [
						productLine({
							enabled: false,
							missingRequirementItemIds: [
								"item:twig",
							],
							requirementItemIds: [
								"item:twig",
							],
							requirementsReady: false,
						}),
					],
					requirements: [],
					trigger: "click",
				}),
			}),
		).toEqual({
			type: "swap",
		});
	});

	it("routes missing stored requirements before craft inputs", () => {
		expect(
			resolveDropIntent({
				config,
				sourceItemId: "item:twig",
				targetItem: {
					...activationTarget({
						inputs: [],
						kind: "producer",
						requirements: [
							{
								capacity: 1,
								itemId: "item:twig",
								quantity: 1,
								stored: 0,
								type: "stored",
							},
						],
						trigger: "click",
					}),
					craft: {
						acceptedInputItemIds: [
							"item:twig",
						],
						canAcceptInputs: true,
						complete: false,
						delivered: {},
						durationMs: 1000,
						id: "craft:test",
						inputProgress: 0,
						inputs: [
							{
								itemId: "item:twig",
								quantity: 1,
							},
						],
						phase: "collecting_inputs",
						progress: 0,
						resultItemId: "item:plank",
						timeProgress: 0,
					},
				},
			}),
		).toEqual({
			type: "stored-requirement",
		});
	});
	it("routes stash inputs before the swap fallback", () => {
		expect(
			resolveDropIntent({
				config,
				sourceItemId: "item:twig",
				targetItem: activationTarget({
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
							stored: 0,
						},
					],
					kind: "stash",
					requirements: [],
					trigger: "click",
				}),
			}),
		).toEqual({
			type: "stash-input",
		});
	});
});
