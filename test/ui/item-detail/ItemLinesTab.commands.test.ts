// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { act } from "react";

import {
	__fixture_commands as commands,
	__fixture_control as control,
	input,
	projection,
	renderLines,
} from "./ItemLinesTab.test/fixture";

describe("ItemLinesTab / command admission", () => {
	it("keeps engine-eligible line actions clickable while their presentation status is pending", async () => {
		control.readPendingAction.mockImplementation((key: string) => {
			if (key.includes('"default"')) return "default";
			if (key.includes('"enqueue"')) return "enqueue";
			if (key.includes('"withdraw"')) return "withdraw";
			return null;
		});
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					actions: {
						enqueue: {
							enabled: true,
						},
						canWithdraw: true,
					},
					input: [
						{
							...input,
							canWithdraw: true,
							storedQuantity: 1,
						},
					],
				},
			],
		});
		const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
		const pendingLabels = [
			"Saving…",
			"Withdrawing…",
		];

		for (const label of pendingLabels) {
			const button = buttons.find((candidate) => candidate.textContent === label);
			expect(button, `Missing ${label} button.`).toBeDefined();
			expect(button?.disabled).toBe(false);
		}
		const enqueue = buttons.find((candidate) => candidate.textContent === "Enqueue");
		expect(enqueue?.disabled).toBe(false);
		expect(enqueue?.getAttribute("aria-busy")).toBe("true");
		expect(
			control.readPendingAction.mock.calls.map(([key]) => JSON.parse(key as string).at(-1)),
		).toEqual(
			expect.arrayContaining([
				"default",
				"enqueue",
				"withdraw",
			]),
		);
	});
	it("keeps Enqueue geometry and copy stable while its command is pending", async () => {
		control.readPendingAction.mockImplementation((key: string) =>
			key.includes('"enqueue"') ? "enqueue" : null,
		);
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
				},
			],
		});
		const button = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineEnqueueButton"]',
		);
		expect(button?.textContent).toBe("Enqueue");
		expect(button?.getAttribute("aria-busy")).toBe("true");
	});
	it("exposes Enqueue as the only line execution command", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					actions: {
						enqueue: {
							enabled: true,
						},
						canWithdraw: false,
					},
				},
			],
		});
		const enqueue = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineEnqueueButton"]',
		);
		const runtime = document.querySelector<HTMLElement>('[data-ui="TileLineRuntime"]');
		expect(enqueue?.textContent).toBe("Enqueue");
		expect(document.querySelector('[data-ui="TileLineStartButton"]')).toBeNull();
		expect(
			enqueue !== null &&
				runtime !== null &&
				(enqueue.compareDocumentPosition(runtime) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
		).toBe(true);
		await act(async () => enqueue?.click());
		expect(commands.enqueue).toHaveBeenCalledWith({
			ownerItemId: projection.itemId,
			lineId: projection.line[0]?.lineId,
		});
	});
});
