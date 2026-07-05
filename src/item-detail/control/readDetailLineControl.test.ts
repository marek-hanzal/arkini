import { describe, expect, it, vi } from "vitest";
import type { LineView } from "~/board/view/LineViewSchema";
import { readDetailLineControl } from "~/item-detail/control/readDetailLineControl";

const createLine = (overrides: Partial<LineView> = {}): LineView => ({
	blocked: false,
	durationMs: 1000,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault: false,
	kind: "product",
	name: "Log",
	queueUsed: 0,
	lineId: "line:lumberjack:log",
	queueFull: false,
	jobs: 0,
	queueMax: 1,
	...overrides,
});

describe("readDetailLineControl", () => {
	it("packages line start control outside the line component", () => {
		const onStart = vi.fn();
		const control = readDetailLineControl({
			canSetDefault: true,
			line: createLine(),
			onSetDefault: () => undefined,
			onStart,
			onWithdrawInput: () => undefined,
			pending: false,
		});

		control.primaryAction.onClick();

		expect(onStart).toHaveBeenCalledWith("line:lumberjack:log");
		expect(control.primaryAction.label).toBe("Start");
		expect(control.primaryAction.metaLabel).toBe("Queue 0/1 · 1s");
		expect(control.primaryAction.tone).toBe("primary");
	});

	it("shows effect window and duration multipliers in the primary action metadata", () => {
		const control = readDetailLineControl({
			canSetDefault: false,
			line: createLine({
				durationMs: 45000,
				effectDurationMultiplier: 0.75,
				kind: "effect",
			}),
			onSetDefault: () => undefined,
			onStart: () => undefined,
			onWithdrawInput: () => undefined,
			pending: false,
		});

		expect(control.primaryAction.metaLabel).toBe("Window 45s · faster 0.75×");
	});

	it("keeps disabled actions inert", () => {
		const onStart = vi.fn();
		const control = readDetailLineControl({
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

	it("packages default and withdraw controls outside the line component", () => {
		const onSetDefault = vi.fn();
		const onWithdrawInput = vi.fn();
		const control = readDetailLineControl({
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
		expect(onSetDefault).toHaveBeenCalledWith("line:lumberjack:log");
		expect(onWithdrawInput).toHaveBeenCalledWith("line:lumberjack:log", "item:log");
	});

	it("disables default controls for hidden runtime-only lines", () => {
		const onSetDefault = vi.fn();
		const control = readDetailLineControl({
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
