import { describe, expect, it, vi } from "vitest";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { readDetailProducerLineControl } from "~/v0/item-detail/control/readDetailProducerLineControl";

const createLine = (overrides: Partial<ProducerProductLineView> = {}): ProducerProductLineView => ({
	blocked: false,
	durationMs: 1000,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault: false,
	lineKind: "product",
	name: "Log",
	producerQueuedJobs: 0,
	productId: "product:lumberjack:log",
	queueFull: false,
	queuedJobs: 0,
	queueSize: 1,
	...overrides,
});

describe("readDetailProducerLineControl", () => {
	it("packages product start control outside the product-line component", () => {
		const onStart = vi.fn();
		const control = readDetailProducerLineControl({
			canSetDefault: true,
			line: createLine(),
			onSetDefault: () => undefined,
			onStart,
			onWithdrawInput: () => undefined,
			pending: false,
		});

		control.primaryAction.onClick();

		expect(onStart).toHaveBeenCalledWith("product:lumberjack:log");
		expect(control.primaryAction.label).toBe("Start");
		expect(control.primaryAction.tone).toBe("primary");
	});

	it("keeps disabled actions inert", () => {
		const onStart = vi.fn();
		const control = readDetailProducerLineControl({
			canSetDefault: false,
			line: createLine({
				inputItemIds: [
					"item:log",
				],
				inputs: [
					{
						available: 0,
						capacity: 1,
						consume: true,
						itemId: "item:log",
						quantity: 1,
						stored: 0,
					},
				],
				inputsAvailable: false,
				inputsReady: false,
			}),
			onSetDefault: () => undefined,
			onStart,
			onWithdrawInput: () => undefined,
			pending: false,
		});

		control.primaryAction.onClick();

		expect(control.primaryAction.disabled).toBe(true);
		expect(control.primaryAction.label).toBe("Missing items");
		expect(onStart).not.toHaveBeenCalled();
	});

	it("packages default and withdraw controls outside the product-line component", () => {
		const onSetDefault = vi.fn();
		const onWithdrawInput = vi.fn();
		const control = readDetailProducerLineControl({
			canSetDefault: true,
			line: createLine({
				inputs: [
					{
						available: 0,
						capacity: 2,
						consume: true,
						itemId: "item:log",
						quantity: 1,
						stored: 1,
					},
				],
				isDefault: true,
			}),
			onSetDefault,
			onStart: () => undefined,
			onWithdrawInput,
			pending: false,
		});

		control.defaultAction?.onClick();
		control.withdrawInputActionsByItemId["item:log"]?.onClick();

		expect(control.defaultAction?.label).toBe("Un-default");
		expect(onSetDefault).toHaveBeenCalledWith("product:lumberjack:log");
		expect(onWithdrawInput).toHaveBeenCalledWith("product:lumberjack:log", "item:log");
	});

	it("disables default controls for hidden runtime-only lines", () => {
		const onSetDefault = vi.fn();
		const control = readDetailProducerLineControl({
			canSetDefault: true,
			line: createLine({
				visible: false,
			}),
			onSetDefault,
			onStart: () => undefined,
			onWithdrawInput: () => undefined,
			pending: false,
		});

		control.defaultAction?.onClick();

		expect(control.defaultAction?.disabled).toBe(true);
		expect(control.primaryAction.disabled).toBe(true);
		expect(control.primaryAction.label).toBe("Line hidden");
		expect(onSetDefault).not.toHaveBeenCalled();
	});
});
