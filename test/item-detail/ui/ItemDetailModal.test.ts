// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ItemDetailModal } from "~/item-detail/ui/ItemDetailModal";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	openItemDetail: vi.fn(),
	tabs: [
		"sources",
		"info",
	] as readonly string[],
}));

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

vi.mock("~/game-presentation/ui/useGameEngine", () => ({
	useGameEngine: () => ({
		config: {
			items: {},
		},
		getResourceUrlFn: (resourceId: string) => resourceId,
		readOrThrowFn: <Value>(value: Value) => value,
	}),
}));

vi.mock("~/game-presentation/ui/useRuntimeSelector", () => ({
	useRuntimeSelector: (
		_game: unknown,
		selector: (runtime: { readonly items: readonly never[] }) => unknown,
	) =>
		selector({
			items: [],
		}),
}));

vi.mock("~/item-detail-read/fx/readItemDetailIdentityFx", () => ({
	readItemDetailIdentityFx: () => ({
		definitionId: "item",
		itemId: "runtime:item",
		kind: "available",
		sourceResourceIds: [
			"item.png",
		],
		title: "Item",
	}),
}));

vi.mock("~/item-detail-read/fn/readItemDetailInfoFn", () => ({
	readItemDetailInfoFn: () => ({
		kind: "unavailable",
	}),
}));

vi.mock("~/item-detail-read/fx/readItemDetailSourcesFx", () => ({
	readItemDetailSourcesFx: () => ({
		kind: "unavailable",
	}),
}));

vi.mock("~/item-detail-read/fn/readItemDetailTabsFn", () => ({
	readItemDetailTabsFn: () => state.tabs,
}));

vi.mock("~/item-detail/fx/projectItemDetailQueueFx", () => ({
	projectItemDetailQueueFx: () => ({
		kind: "unavailable",
	}),
}));

vi.mock("~/item-line-detail/ui/useItemDetailLines", () => ({
	useItemDetailLines: () => ({
		kind: "unavailable",
	}),
}));

vi.mock("~/item-detail-frame/ui/useItemDetailControl", () => ({
	useItemDetailControl: () => ({
		openItemDetailFx: (props: unknown) => state.openItemDetail(props),
		state: {
			generation: 1,
			phase: "open",
			target: {
				itemId: "runtime:item",
				kind: "runtime",
				origin: null,
				tab: "sources",
			},
		},
	}),
}));

vi.mock("~/item-detail-frame/ui/useCloseItemDetail", () => ({
	useCloseItemDetail: () => () => undefined,
}));

vi.mock("~/item-detail-frame/ui/ItemDetailHeader", () => ({
	ItemDetailHeader: () => null,
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	state.openItemDetail.mockReset();
	state.openItemDetail.mockReturnValue(Effect.succeed(true));
	state.tabs = [
		"sources",
		"info",
	];
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("ItemDetailModal source ownership", () => {
	it("falls back from Sources when the last owned source disappears", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const render = async () => {
			await act(async () => root.render(createElement(ItemDetailModal)));
		};

		await render();
		expect(state.openItemDetail).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(
			container.querySelector('[data-ui="ItemDetailTabs"] button[data-ui-selected="true"]'),
		);

		state.tabs = [
			"info",
		];
		await render();

		expect(state.openItemDetail).toHaveBeenCalledWith({
			itemId: "runtime:item",
		});
	});
});
