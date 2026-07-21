// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";
import { ItemLinesTab } from "~/ui/item-detail/ItemLinesTab";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const control = vi.hoisted(() => ({
	openItemDetail: vi.fn(),
	openItemDefinitionDetail: vi.fn(),
}));
const commands = vi.hoisted(() => ({
	autofill: vi.fn(() => Promise.resolve()),
	setDefault: vi.fn(() => Promise.resolve()),
	start: vi.fn(() => Promise.resolve()),
	unsetDefault: vi.fn(() => Promise.resolve()),
	withdraw: vi.fn(() => Promise.resolve()),
}));

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));
vi.mock("~/ui/item-detail/useItemDetailControl", () => ({
	useItemDetailControl: () => control,
}));
vi.mock("~/bridge/item-detail/useAutofillItemDetailLine", () => ({
	useAutofillItemDetailLine: () => commands.autofill,
}));
vi.mock("~/bridge/item-detail/useSetDefaultItemDetailLine", () => ({
	useSetDefaultItemDetailLine: () => commands.setDefault,
}));
vi.mock("~/bridge/item-detail/useStartItemDetailLine", () => ({
	useStartItemDetailLine: () => commands.start,
}));
vi.mock("~/bridge/item-detail/useUnsetDefaultItemDetailLine", () => ({
	useUnsetDefaultItemDetailLine: () => commands.unsetDefault,
}));
vi.mock("~/bridge/item-detail/useWithdrawItemDetailLine", () => ({
	useWithdrawItemDetailLine: () => commands.withdraw,
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

const input = {
	kind: "materials",
	selector: {
		kind: "item",
		label: "Tree",
	},
	mode: "consume",
	required: {
		min: 1,
		max: 1,
	},
	storedQuantity: 0,
	maxStoredQuantity: 1,
	missingQuantity: 1,
	availableCapacity: 1,
	ready: true,
	detail: {
		itemId: "tree",
		title: "Tree",
		sourceUrl: "resource:tree",
		detailItemId: "runtime:tree",
	},
} as const satisfies useItemDetailLines.Input;

const output = {
	weight: 1,
	roll: [
		{
			kind: "guaranteed",
			item: [
				{
					itemId: "log",
					title: "Log",
					quantity: {
						min: 1,
						max: 1,
					},
					sourceUrl: "resource:log",
					definitionItemId: "log",
				},
			],
		},
	],
} as const satisfies useItemDetailLines.OutputSet;

const line = ({
	active = false,
	isDefault = false,
	lineId,
	title,
}: {
	readonly active?: boolean;
	readonly isDefault?: boolean;
	readonly lineId: string;
	readonly title: string;
}): useItemDetailLines.Line => ({
	lineId,
	title,
	description: `${title} description.`,
	baseRuntimeMs: 1_000,
	effectiveRuntimeMs: 1_000,
	availability: {
		kind: "ready",
	},
	startMode: "start",
	isDefault,
	actions: {
		canAutofill: false,
		canWithdraw: false,
	},
	input: [
		input,
	],
	output: [
		output,
	],
	...(active
		? {
				activeJob: {
					status: "running" as const,
					durationMs: 1_000,
					remainingMs: 500,
				},
			}
		: {}),
});

const projection = {
	kind: "available",
	itemId: "runtime:producer",
	line: [
		line({
			lineId: "line:first",
			title: "First",
		}),
		line({
			active: true,
			isDefault: true,
			lineId: "line:second",
			title: "Second",
		}),
	],
} as const satisfies useItemDetailLines.Projection;

beforeEach(() => {
	for (const value of Object.values(control)) value.mockReset();
	for (const value of Object.values(commands)) {
		value.mockReset();
		value.mockResolvedValue(undefined);
	}
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const renderLines = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(ItemLinesTab, {
				disabled: false,
				lines: projection,
			}),
		);
	});
};

describe("ItemLinesTab", () => {
	it("opens exact input runtime detail and configured output detail from subtle artwork links", async () => {
		await renderLines();
		const inputLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineInputDetailLink"]',
		);
		const outputLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineOutputDetailLink"]',
		);
		if (inputLink === null || outputLink === null) throw new Error("Missing item links.");

		expect(inputLink.disabled).toBe(false);
		expect(outputLink.disabled).toBe(false);
		expect(inputLink.className).toContain("enabled:cursor-pointer");
		expect(outputLink.className).toContain("enabled:cursor-pointer");

		await act(async () => inputLink.click());
		expect(control.openItemDetail).toHaveBeenCalledWith({
			itemId: "runtime:tree",
		});

		await act(async () => outputLink.click());
		expect(control.openItemDefinitionDetail).toHaveBeenCalledWith({
			itemId: "log",
		});
	});

	it("keeps authored order, toggles default state, and reserves active border geometry", async () => {
		await renderLines();
		const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-ui="TileLine"]'));
		expect(rows.map((row) => row.dataset.lineId)).toEqual([
			"line:first",
			"line:second",
		]);
		expect(rows[0]?.className).toContain("border-l-2");
		expect(rows[0]?.className).toContain("border-l-line/55");
		expect(rows[1]?.className).toContain("border-l-2");
		expect(rows[1]?.className).toContain("border-l-success");
		expect(rows[1]?.className).toContain("ak-list-row-active");

		const buttons = Array.from(
			document.querySelectorAll<HTMLButtonElement>('[data-ui="TileLineSetDefaultButton"]'),
		);
		expect(buttons.map((button) => button.textContent)).toEqual([
			"Set default",
			"Unset default",
		]);

		await act(async () => {
			buttons[0]?.click();
			await Promise.resolve();
		});
		expect(commands.setDefault).toHaveBeenCalledWith({
			ownerItemId: "runtime:producer",
			lineId: "line:first",
		});

		await act(async () => {
			buttons[1]?.click();
			await Promise.resolve();
		});
		expect(commands.unsetDefault).toHaveBeenCalledWith({
			ownerItemId: "runtime:producer",
		});
	});
});
