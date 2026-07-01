import { describe, expect, it, vi } from "vitest";
import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";
import { readDetailCraftControl } from "~/v0/item-detail/control/readDetailCraftControl";

const createCraft = (overrides: Partial<CraftProgressView> = {}): CraftProgressView => ({
	acceptedInputItemIds: [],
	canAcceptInputs: true,
	complete: false,
	delivered: {},
	durationMs: 1000,
	id: "craft:well",
	inputProgress: 0,
	inputs: [],
	phase: "collecting_inputs",
	progress: 0,
	resultItemId: "producer:well-t1",
	timeProgress: 0,
	...overrides,
});

describe("readDetailCraftControl", () => {
	it("packages claim/start choice outside the craft component", () => {
		const onClaim = vi.fn();
		const onStart = vi.fn();
		const control = readDetailCraftControl({
			craft: createCraft({
				complete: true,
				phase: "ready",
			}),
			onClaim,
			onStart,
			onWithdrawInput: () => undefined,
			pending: false,
		});

		control.primaryAction.onClick();

		expect(onClaim).toHaveBeenCalledOnce();
		expect(onStart).not.toHaveBeenCalled();
		expect(control.primaryAction.label).toBe("Claim");
	});

	it("packages withdraw availability outside the craft component", () => {
		const onWithdrawInput = vi.fn();
		const control = readDetailCraftControl({
			craft: createCraft({
				delivered: {
					"item:log": 1,
				},
				inputs: [
					{
						itemId: "item:log",
						quantity: 2,
					},
				],
			}),
			onClaim: () => undefined,
			onStart: () => undefined,
			onWithdrawInput,
			pending: false,
		});

		control.withdrawInputActionsByItemId["item:log"]?.onClick();

		expect(onWithdrawInput).toHaveBeenCalledWith("item:log");
	});

	it("packages craft status and progress for the action button", () => {
		const control = readDetailCraftControl({
			craft: createCraft({
				delivered: {
					"item:log": 1,
				},
				inputProgress: 0.5,
				inputs: [
					{
						itemId: "item:log",
						quantity: 2,
					},
				],
				progress: 0.5,
			}),
			onClaim: () => undefined,
			onStart: () => undefined,
			onWithdrawInput: () => undefined,
			pending: false,
		});

		expect(control.statusLabel).toBe("Collecting inputs");
		expect(control.primaryAction.progress).toBe(0.5);
		expect(control.primaryAction).not.toHaveProperty("progressAutoCompleteMs");
	});

	it("keeps waiting craft button progress tied to the live runtime view", () => {
		const control = readDetailCraftControl({
			craft: createCraft({
				phase: "waiting",
				progress: 0.25,
				remainingMs: 750,
			}),
			onClaim: () => undefined,
			onStart: () => undefined,
			onWithdrawInput: () => undefined,
			pending: false,
		});

		expect(control.primaryAction.progress).toBe(0.25);
		expect(control.primaryAction).not.toHaveProperty("progressAutoCompleteMs");
	});
});
