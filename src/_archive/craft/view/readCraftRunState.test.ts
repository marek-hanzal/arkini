import { describe, expect, it } from "vitest";
import type { CraftProgressView } from "~/board/view/CraftProgressViewSchema";
import { readCraftRunState } from "~/craft/view/readCraftRunState";

const craft = (overrides: Partial<CraftProgressView> = {}): CraftProgressView => ({
	acceptedInputItemIds: [
		"item:twig",
	],
	canAcceptInputs: true,
	complete: false,
	delivered: {},
	durationMs: 1000,
	id: "recipe:stick",
	inputProgress: 0,
	inputs: [
		{
			available: 1,
			itemId: "item:twig",
			quantity: 1,
		},
	],
	phase: "collecting_inputs",
	progress: 0,
	resultItemId: "item:stick",
	timeProgress: 0,
	...overrides,
});

describe("readCraftRunState", () => {
	it("allows collecting crafts to auto-fill available inputs", () => {
		expect(
			readCraftRunState({
				craft: craft(),
			}),
		).toMatchObject({
			canRunAction: true,
			inputsPartiallyAvailable: true,
			label: "Auto-fill inputs",
		});
	});

	it("allows collecting crafts to start when inputs are delivered", () => {
		expect(
			readCraftRunState({
				craft: craft({
					delivered: {
						"item:twig": 1,
					},
					inputProgress: 1,
					inputs: [
						{
							available: 0,
							itemId: "item:twig",
							quantity: 1,
						},
					],
				}),
			}),
		).toMatchObject({
			canRunAction: true,
			label: "Start craft",
		});
	});

	it("blocks collecting crafts while start requirements are missing", () => {
		expect(
			readCraftRunState({
				craft: craft({
					startRequirementsReady: false,
				}),
			}),
		).toMatchObject({
			canRunAction: false,
			label: "Requirements missing",
		});
	});

	it("blocks collecting crafts while a start-block effect is active", () => {
		expect(
			readCraftRunState({
				craft: craft({
					effectBlocked: true,
				}),
			}),
		).toMatchObject({
			canRunAction: false,
			label: "Blocked",
		});
	});

	it("labels blocked delivery without allowing another start", () => {
		expect(
			readCraftRunState({
				craft: craft({
					deliveryBlocked: true,
					phase: "delivery_blocked",
				}),
			}),
		).toMatchObject({
			canRunAction: false,
			label: "Delivery blocked",
		});
	});
});
