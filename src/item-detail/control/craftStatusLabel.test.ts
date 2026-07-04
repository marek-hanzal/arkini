import { describe, expect, it } from "vitest";
import type { CraftProgressView } from "~/board/view/CraftProgressViewSchema";
import { craftStatusLabel } from "~/item-detail/control/craftStatusLabel";

const craft = (overrides: Partial<CraftProgressView> = {}): CraftProgressView => ({
	acceptedInputItemIds: [],
	canAcceptInputs: false,
	complete: false,
	delivered: {},
	durationMs: 1000,
	id: "item:craft-target",
	inputProgress: 0,
	inputs: [],
	phase: "collecting_inputs",
	progress: 0,
	resultItemId: "item:plank",
	timeProgress: 0,
	...overrides,
});

describe("craftStatusLabel", () => {
	it("surfaces missing effect start requirements before generic collection status", () => {
		expect(
			craftStatusLabel({
				craft: craft({
					startRequirementsReady: false,
				}),
			}),
		).toBe("Requirements missing");
	});
});
