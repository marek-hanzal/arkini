// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, vi } from "vitest";

import { ItemDetailModal } from "~/ui/item-detail/ItemDetailModal";

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

vi.mock("~/ui/item-detail/useItemDetailFocus", () => ({
	useItemDetailFocus: () => ({
		dialogRef: {
			current: null,
		},
		keepFocusInside: () => undefined,
	}),
}));

vi.mock("~/ui/item-detail/useItemDetailMotion", () => ({
	useItemDetailMotion: () => ({
		backdropOpacity: 1,
		completeMotionPhase: () => undefined,
		dialog: {
			opacity: 1,
			y: 0,
		},
	}),
}));

vi.mock("~/ui/item-detail/useItemDetailIdentity", () => ({
	useItemDetailIdentity: () => ({
		definitionId: "item",
		kind: "available",
	}),
}));

vi.mock("~/ui/item-detail/useItemDetailInfo", () => ({
	useItemDetailInfo: () => ({
		kind: "unavailable",
	}),
}));

vi.mock("~/item-line-detail/ui/useItemDetailLines", () => ({
	useItemDetailLines: () => ({
		kind: "unavailable",
	}),
}));

vi.mock("~/ui/item-detail/useItemDetailQueue", () => ({
	useItemDetailQueue: () => ({
		kind: "unavailable",
	}),
}));

vi.mock("~/ui/item-detail/useItemDetailSources", () => ({
	useItemDetailSources: () => ({
		kind: "available",
		source: [],
		targetTitle: "Item",
	}),
}));

vi.mock("~/ui/item-detail/useItemDetailTabs", () => ({
	useItemDetailTabs: () => state.tabs,
}));

vi.mock("~/ui/item-detail/useItemDefinitionDetail", () => ({
	useItemDefinitionDetail: () => ({
		kind: "unavailable",
	}),
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

export const renderSourceDetail = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const render = async () => {
		await act(async () => root.render(createElement(ItemDetailModal)));
	};
	await render();
	return {
		dropSources: async () => {
			state.tabs = [
				"info",
			];
			await render();
		},
		openItemDetail: state.openItemDetail,
	};
};
