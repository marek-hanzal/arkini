// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ItemQueueTab } from "~/item-detail/ui/ItemQueueTab";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const control = vi.hoisted(() => ({
	readActionError: vi.fn(() => null),
	readPendingAction: vi.fn(() => null),
	runPendingAction: vi.fn(),
}));
const clearQueue = vi.hoisted(() => vi.fn((command: unknown) => command));
const game = vi.hoisted(() => ({
	runFx: vi.fn((effect: unknown) => effect),
}));

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

vi.mock("~/item-detail-frame/ui/useItemDetailControl", () => ({
	useItemDetailControl: () => control,
}));

vi.mock("~/game-presentation/ui/useGameEngine", () => ({
	useGameEngine: () => game,
}));

vi.mock("~/production-job/write/clearItemJobQueueFx", () => ({
	clearItemJobQueueFx: clearQueue,
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	for (const mock of Object.values(control)) mock.mockReset();
	control.readActionError.mockReturnValue(null);
	control.readPendingAction.mockReturnValue(null);
	clearQueue.mockClear();
	game.runFx.mockClear();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("ItemQueueTab command boundary", () => {
	it("wires clear to the exact queue owner and pending identity", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(ItemQueueTab, {
					queue: {
						active: [],
						capacity: 2,
						itemId: "runtime:owner",
						kind: "available",
						request: [
							{
								lineId: "line:first",
								requestId: "request:first",
								status: "inputs-ready",
								title: "First line",
							},
						],
					},
				}),
			);
		});

		const button = container.querySelector<HTMLButtonElement>(
			'[data-ui="ItemQueueClearButton"]',
		);
		await act(async () => button?.click());

		expect(clearQueue).toHaveBeenCalledWith({
			ownerItemId: "runtime:owner",
		});
		expect(control.runPendingAction).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "clear-queue",
				key: JSON.stringify([
					"queue",
					"runtime:owner",
				]),
			}),
		);
	});
});
