// @vitest-environment jsdom

import { Effect } from "effect";

import { act, createElement } from "react";

import { createRoot } from "react-dom/client";

import { afterEach, beforeEach, vi } from "vitest";

import type { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";

import type { ItemDetailPendingAction } from "~/ui/item-detail/ItemDetailControl";

import { ItemLinesTab } from "~/ui/item-detail/ItemLinesTab";

import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const control = vi.hoisted(() => ({
	openItemDetailFx: vi.fn(),
	openItemDefinitionDetailFx: vi.fn(),
	readActionError: vi.fn((_key: string) => null),
	readPendingAction: vi.fn((_key: string): ItemDetailPendingAction | null => null),
	runPendingAction: vi.fn(),
}));

export const __fixture_control = control;

const commands = vi.hoisted(() => ({
	enqueue: vi.fn(),
	setDefault: vi.fn(),
	unsetDefault: vi.fn(),
	withdraw: vi.fn(),
}));

export const __fixture_commands = commands;

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

vi.mock("~/ui/item-detail/useItemDetailControl", () => ({
	useItemDetailControl: () => control,
}));

vi.mock("~/bridge/item-detail/useEnqueueItemDetailLine", () => ({
	useEnqueueItemDetailLine: ({ pendingKey }: { readonly pendingKey: string }) => ({
		error: control.readActionError(pendingKey),
		pending: control.readPendingAction(pendingKey) === "enqueue",
		run: commands.enqueue,
	}),
}));

vi.mock("~/bridge/item-detail/useSetDefaultItemDetailLine", () => ({
	useSetDefaultItemDetailLine: ({ pendingKey }: { readonly pendingKey: string }) => ({
		error: control.readActionError(pendingKey),
		pending: control.readPendingAction(pendingKey) === "default",
		run: commands.setDefault,
	}),
}));

vi.mock("~/bridge/item-detail/useUnsetDefaultItemDetailLine", () => ({
	useUnsetDefaultItemDetailLine: ({ pendingKey }: { readonly pendingKey: string }) => ({
		error: control.readActionError(pendingKey),
		pending: control.readPendingAction(pendingKey) === "default",
		run: commands.unsetDefault,
	}),
}));

vi.mock("~/bridge/item-detail/useWithdrawItemDetailLine", () => ({
	useWithdrawItemDetailLine: ({ pendingKey }: { readonly pendingKey: string }) => ({
		error: control.readActionError(pendingKey),
		pending: control.readPendingAction(pendingKey) === "withdraw",
		run: commands.withdraw,
	}),
}));

export const roots: Array<ReturnType<typeof createRoot>> = [];

export let nextFrameId = 0;

export let animationFrames = new Map<number, FrameRequestCallback>();

export const rect = ({
	bottom,
	left = 0,
	right = 100,
	top,
}: {
	readonly bottom: number;
	readonly left?: number;
	readonly right?: number;
	readonly top: number;
}): DOMRect => ({
	bottom,
	height: bottom - top,
	left,
	right,
	top,
	width: right - left,
	x: left,
	y: top,
	toJSON: () => ({}),
});

export const flushAnimationFrame = async () => {
	const pending = [
		...animationFrames.entries(),
	];
	animationFrames = new Map();
	await act(async () => {
		for (const [, callback] of pending) callback(performance.now());
	});
};

export const input = {
	kind: "materials",
	inputIndex: 0,
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
	deliveryQuantity: 0,
	autofillAvailableQuantity: 0,
	maxStoredQuantity: 1,
	missingQuantity: 1,
	availableCapacity: 1,
	ready: true,
	canWithdraw: false,
	detail: {
		itemId: "tree",
		title: "Tree",
		sourceUrl: "resource:tree",
		detailItemId: "runtime:tree",
	},
} as const satisfies useItemDetailLines.Input;

export const output = {
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
					activeRuleHints: [],
					sourceUrl: "resource:log",
					definitionItemId: "log",
				},
			],
		},
	],
} as const satisfies useItemDetailLines.OutputSet;

export const depositInput = {
	kind: "deposit",
	selector: {
		kind: "item",
		label: "Tree",
	},
	distance: "close",
	requiredCharges: 1,
	availableCharges: 33,
	availableChargesLabel: "33",
	targetTitles: [
		"Tree",
	],
	ready: true,
	charges: {
		cost: 1,
		from: "target",
	},
	detail: {
		itemId: "tree",
		title: "Tree",
		sourceUrl: "resource:tree",
		detailItemId: "runtime:tree",
	},
} as const satisfies useItemDetailLines.Input;

export const line = ({
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
		kind: "available",
		readiness: "ready",
	},
	activeRuleHints: [],
	isDefault,
	queuedRequestCount: 0,
	actions: {
		enqueue: {
			enabled: true,
		},
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
					status: JobStatusEnumSchema.enum.Running,
					durationMs: 1_000,
					remainingMs: 500,
				},
			}
		: {}),
});

export const projection = {
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
	nextFrameId = 0;
	animationFrames = new Map();
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
		const frameId = ++nextFrameId;
		animationFrames.set(frameId, callback);
		return frameId;
	});
	vi.stubGlobal("cancelAnimationFrame", (frameId: number) => {
		animationFrames.delete(frameId);
	});
	for (const value of Object.values(control)) value.mockReset();
	control.readActionError.mockReturnValue(null);
	control.readPendingAction.mockReturnValue(null);
	control.openItemDetailFx.mockReturnValue(Effect.succeed(true));
	control.openItemDefinitionDetailFx.mockReturnValue(Effect.succeed(true));
	for (const value of Object.values(commands)) {
		value.mockReset();
	}
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	vi.unstubAllGlobals();
});

export const renderLines = async (
	lines: Extract<
		useItemDetailLines.Projection,
		{
			kind: "available";
		}
	> = projection,
	initialQuery?: string,
) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const rerender = async (
		nextLines: Extract<
			useItemDetailLines.Projection,
			{
				kind: "available";
			}
		>,
	) => {
		await act(async () => {
			root.render(
				createElement(ItemLinesTab, {
					key: nextLines.itemId,
					disabled: false,
					initialQuery,
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

export const setSearchQuery = async (container: HTMLElement, value: string) => {
	const search = container.querySelector<HTMLInputElement>('[aria-label="Search visible lines"]');
	if (search === null) throw new Error("Expected Lines search input.");
	const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (valueSetter === undefined) throw new Error("Expected native input value setter.");
	await act(async () => {
		valueSetter.call(search, value);
		search.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};

export const selectAvailabilityFilter = async (
	container: HTMLElement,
	value: "available" | "all",
) => {
	const option = container.querySelector<HTMLInputElement>(
		`input[name="item-lines-availability"][value="${value}"]`,
	);
	if (option === null) throw new Error(`Expected ${value} availability option.`);
	await act(async () => option.click());
};
