// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, vi } from "vitest";

import type { useItemDetailLines } from "~/ui/item-detail/useItemDetailLines";
import type { ItemDetailPendingAction } from "~/ui/item-detail/ItemDetailControl";
import { ItemLinesTab } from "~/ui/item-detail/ItemLinesTab";

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

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

vi.mock("~/ui/item-detail/useItemDetailControl", () => ({
	useItemDetailControl: () => control,
}));

vi.mock("~/ui/item-detail/useEnqueueItemDetailLine", () => ({
	useEnqueueItemDetailLine: ({ pendingKey }: { readonly pendingKey: string }) => ({
		error: control.readActionError(pendingKey),
		pending: control.readPendingAction(pendingKey) === "enqueue",
		run: commands.enqueue,
	}),
}));

vi.mock("~/ui/item-detail/useSetDefaultItemDetailLine", () => ({
	useSetDefaultItemDetailLine: ({ pendingKey }: { readonly pendingKey: string }) => ({
		error: control.readActionError(pendingKey),
		pending: control.readPendingAction(pendingKey) === "default",
		run: commands.setDefault,
	}),
}));

vi.mock("~/ui/item-detail/useUnsetDefaultItemDetailLine", () => ({
	useUnsetDefaultItemDetailLine: ({ pendingKey }: { readonly pendingKey: string }) => ({
		error: control.readActionError(pendingKey),
		pending: control.readPendingAction(pendingKey) === "default",
		run: commands.unsetDefault,
	}),
}));

vi.mock("~/ui/item-detail/useWithdrawItemDetailLine", () => ({
	useWithdrawItemDetailLine: ({ pendingKey }: { readonly pendingKey: string }) => ({
		error: control.readActionError(pendingKey),
		pending: control.readPendingAction(pendingKey) === "withdraw",
		run: commands.withdraw,
	}),
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
} as const satisfies useItemDetailLines.Input;

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
} as const satisfies useItemDetailLines.Projection;

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	vi.stubGlobal("requestAnimationFrame", () => 1);
	vi.stubGlobal("cancelAnimationFrame", () => undefined);
	for (const value of Object.values(control)) value.mockReset();
	control.openItemDefinitionDetailFx.mockReturnValue(Effect.succeed(true));
	control.openItemDetailFx.mockReturnValue(Effect.succeed(true));
	control.readActionError.mockReturnValue(null);
	control.readPendingAction.mockReturnValue(null);
	for (const command of Object.values(commands)) command.mockReset();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	vi.unstubAllGlobals();
});

export const setPendingAction = (action: ItemDetailPendingAction) => {
	control.readPendingAction.mockReturnValue(action);
};

type AvailableProjection = Extract<
	useItemDetailLines.Projection,
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
