// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, vi } from "vitest";

import type { ItemDetailLines } from "~/item-line-detail/ui/ItemDetailLines";
import type { ItemDetailPendingAction } from "~/item-detail-frame/ItemDetailControl";
import { ItemLinesTab } from "~/item-line-detail/ui/ItemLinesTab";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const control = vi.hoisted(() => ({
	openItemDefinitionDetailFx: vi.fn(),
	openItemDetailFx: vi.fn(),
	readActionError: vi.fn((_key: string) => null),
	readPendingAction: vi.fn((_key: string): ItemDetailPendingAction | null => null),
	runPendingAction: vi.fn(),
}));

const commandSpies = vi.hoisted(() => ({
	enqueue: vi.fn(),
	setDefault: vi.fn(),
	unsetDefault: vi.fn(),
	withdraw: vi.fn(),
}));

export const commands = commandSpies;

const game = vi.hoisted(() => ({
	runFx: vi.fn((effect: unknown) => effect),
}));

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

vi.mock("~/item-detail-frame/useItemDetailControl", () => ({
	useItemDetailControl: () => control,
}));

vi.mock("~/ui/game/useGameEngine", () => ({
	useGameEngine: () => game,
}));

vi.mock("~/production-job/write/enqueueLineFx", () => ({
	enqueueLineFx: (command: unknown) => {
		commands.enqueue(command);
		return command;
	},
}));

vi.mock("~/production-line/write/setDefaultLineFx", () => ({
	setDefaultLineFx: (command: unknown) => {
		commands.setDefault(command);
		return command;
	},
}));

vi.mock("~/production-line/write/unsetDefaultLineFx", () => ({
	unsetDefaultLineFx: (command: unknown) => {
		commands.unsetDefault(command);
		return command;
	},
}));

vi.mock("~/production-input/write/withdrawLineInputFx", () => ({
	withdrawLineInputFx: (command: unknown) => {
		commands.withdraw(command);
		return {
			pipe: () => undefined,
		};
	},
}));

vi.mock("~/production-input/write/withdrawLineInputsFx", () => ({
	withdrawLineInputsFx: (command: unknown) => {
		commands.withdraw(command);
		return {
			pipe: () => undefined,
		};
	},
}));

export const input = {
	availableCapacity: 1,
	autofillAvailableQuantity: 0,
	canWithdraw: false,
	deliveryQuantity: 0,
	detail: {
		detailItemId: "runtime:tree",
		itemId: "tree",
		sourceUrl: "resource:tree",
		title: "Tree",
	},
	inputIndex: 0,
	kind: "materials",
	maxStoredQuantity: 1,
	missingQuantity: 1,
	mode: "consume",
	ready: true,
	required: {
		max: 1,
		min: 1,
	},
	selector: {
		kind: "item",
		label: "Tree",
	},
	storedQuantity: 0,
} as const satisfies ItemDetailLines.Input;

export const projection = {
	itemId: "runtime:producer",
	kind: "available",
	line: [
		{
			actions: {
				canWithdraw: false,
				enqueue: {
					enabled: true,
				},
			},
			activeRuleHints: [],
			availability: {
				kind: "available",
				readiness: "ready",
			},
			baseRuntimeMs: 1_000,
			description: "First line.",
			effectiveRuntimeMs: 1_000,
			input: [
				input,
			],
			isDefault: false,
			lineId: "line:first",
			output: [],
			queuedRequestCount: 0,
			title: "First",
		},
	],
} as const satisfies ItemDetailLines.Projection;

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	vi.stubGlobal("requestAnimationFrame", () => 1);
	vi.stubGlobal("cancelAnimationFrame", () => undefined);
	for (const value of Object.values(control)) value.mockReset();
	control.openItemDefinitionDetailFx.mockReturnValue(Effect.succeed(true));
	control.openItemDetailFx.mockReturnValue(Effect.succeed(true));
	control.readActionError.mockReturnValue(null);
	control.readPendingAction.mockReturnValue(null);
	game.runFx.mockClear();
	for (const command of Object.values(commands)) command.mockReset();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	vi.unstubAllGlobals();
});

type AvailableProjection = Extract<
	ItemDetailLines.Projection,
	{
		readonly kind: "available";
	}
>;

export const renderLines = async (lines: AvailableProjection) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const rerender = async (nextLines: AvailableProjection) => {
		await act(async () => {
			root.render(
				createElement(ItemLinesTab, {
					disabled: false,
					lines: nextLines,
				}),
			);
		});
	};
	await rerender(lines);
	return {
		container,
		rerender,
	};
};

export const selectAllLines = async (container: HTMLElement) => {
	const option = container.querySelector<HTMLInputElement>(
		'input[name="item-lines-availability"][value="all"]',
	);
	if (option === null) throw new Error("Missing all-lines filter.");
	await act(async () => option.click());
};
