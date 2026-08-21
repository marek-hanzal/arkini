// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";

import { depositInput, input, projection, renderLines } from "./ItemLinesTab.test/fixture";

describe("ItemLinesTab / material delivery state", () => {
	it("shows the exact aggregate quantity currently delivered to a material input", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					input: [
						{
							...input,
							deliveryQuantity: 1,
							required: {
								min: 2,
								max: 2,
							},
						},
					],
				},
			],
		});

		const delivery = document.querySelector<HTMLElement>(
			'[data-ui="TileLineInputDeliveryQuantity"]',
		);
		expect(delivery?.textContent).toBe("1 / 2 on the way");
		expect(document.querySelector('[data-ui="TileLineInputStoredQuantity"]')).toBeNull();
		expect(document.querySelector('[data-ui="TileLineInputWithdrawButton"]')).toBeNull();
	});
	it("transitions semantic input surfaces and makes them transparent under active progress", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					lineId: "line:available",
					input: [
						{
							...input,
							autofillAvailableQuantity: 4,
						},
					],
				},
				{
					...projection.line[0],
					lineId: "line:delivery",
					input: [
						{
							...input,
							autofillAvailableQuantity: 4,
							deliveryQuantity: 1,
						},
					],
				},
				{
					...projection.line[0],
					lineId: "line:partial",
					input: [
						{
							...input,
							required: {
								min: 2,
								max: 2,
							},
							storedQuantity: 1,
						},
					],
				},
				{
					...projection.line[0],
					lineId: "line:stored",
					input: [
						{
							...input,
							storedQuantity: 1,
						},
					],
				},
				{
					...projection.line[0],
					lineId: "line:active",
					activeJob: {
						status: JobStatusEnumSchema.enum.Running,
						durationMs: 1_000,
						remainingMs: 500,
					},
					input: [
						{
							...input,
							storedQuantity: 1,
						},
					],
				},
				{
					...projection.line[0],
					lineId: "line:deposit",
					input: [
						depositInput,
					],
				},
			],
		});

		const renderedInput = (lineId: string) =>
			document.querySelector<HTMLElement>(
				`[data-line-id="${lineId}"] [data-ui="TileLineInput"]`,
			);
		const available = renderedInput("line:available");
		const delivery = renderedInput("line:delivery");
		const partial = renderedInput("line:partial");
		const stored = renderedInput("line:stored");
		const active = renderedInput("line:active");
		const deposit = renderedInput("line:deposit");
		expect(available?.dataset.inputState).toBe("available");
		expect(delivery?.dataset.inputState).toBe("delivery");
		expect(partial?.dataset.inputState).toBe("available");
		expect(stored?.dataset.inputState).toBe("stored");
		expect(active?.dataset.inputState).toBe("stored");
		expect(active?.dataset.surfaceSuppressed).toBe("true");
		expect(deposit?.dataset.inputState).toBe("available");
	});
	it("retains the exact input row while delivery surface fades to transparent running state", async () => {
		const deliveryLine = {
			...projection.line[0],
			lineId: "line:stable-input",
			input: [
				{
					...input,
					deliveryQuantity: 1,
				},
			],
		};
		const { container, rerender } = await renderLines({
			...projection,
			line: [
				deliveryLine,
			],
		});
		const before = container.querySelector<HTMLElement>('[data-ui="TileLineInput"]');

		await rerender({
			...projection,
			line: [
				{
					...deliveryLine,
					activeJob: {
						status: JobStatusEnumSchema.enum.Running,
						durationMs: 1_000,
						remainingMs: 900,
					},
					input: [
						input,
					],
				},
			],
		});

		const running = container.querySelector<HTMLElement>('[data-ui="TileLineInput"]');
		expect(running).toBe(before);
		expect(running?.dataset.surfaceSuppressed).toBe("true");
	});
});
