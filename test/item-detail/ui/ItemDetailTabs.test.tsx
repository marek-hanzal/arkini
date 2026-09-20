// @vitest-environment jsdom

import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { Effect } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { ItemDetailTabs } from "~/item-detail/ui/ItemDetailTabs";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	openItemDetailFx: vi.fn(),
	selectRetainedItemDetailTabFx: vi.fn(),
}));

vi.mock("~/item-detail-frame/ui/useItemDetailControl", () => ({
	useItemDetailControl: () => ({
		openItemDetailFx: state.openItemDetailFx,
		selectRetainedItemDetailTabFx: state.selectRetainedItemDetailTabFx,
	}),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	vi.clearAllMocks();
});

it("switches the mounted Item Detail directly with its local section shortcut", async () => {
	state.openItemDetailFx.mockReturnValue(Effect.succeed(true));
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () =>
		root.render(
			<HotkeysProvider>
				<ItemDetailTabs
					active="lines"
					disabled={false}
					target={{
						kind: "runtime",
						itemId: "runtime:item",
						origin: null,
						tab: "lines",
					}}
				/>
			</HotkeysProvider>,
		),
	);
	await act(async () =>
		document.body.dispatchEvent(
			new KeyboardEvent("keydown", {
				bubbles: true,
				cancelable: true,
				key: "l",
			}),
		),
	);
	expect(state.openItemDetailFx).toHaveBeenCalledExactlyOnceWith({
		itemId: "runtime:item",
		tab: "lines",
	});
});

it("switches an unavailable retained definition without resolving it again", async () => {
	state.selectRetainedItemDetailTabFx.mockReturnValue(Effect.succeed(true));
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () =>
		root.render(
			<HotkeysProvider>
				<ItemDetailTabs
					active="info"
					disabled={false}
					retained
					target={{
						kind: "definition",
						itemId: "removed:definition",
						origin: null,
						tab: "info",
					}}
				/>
			</HotkeysProvider>,
		),
	);
	await act(async () =>
		document.body.dispatchEvent(
			new KeyboardEvent("keydown", {
				bubbles: true,
				cancelable: true,
				key: "l",
			}),
		),
	);
	expect(state.selectRetainedItemDetailTabFx).toHaveBeenCalledExactlyOnceWith({
		kind: "definition",
		itemId: "removed:definition",
		tab: "lines",
	});
});
