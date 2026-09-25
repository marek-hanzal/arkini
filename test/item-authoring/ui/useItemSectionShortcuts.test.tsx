// @vitest-environment jsdom

import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	navigateFn: vi.fn(async () => undefined),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => state.navigateFn,
}));

import { readSectionsFn } from "~/item-authoring/fn/readSectionsFn";
import { useItemSectionShortcuts } from "~/item-authoring/ui/useItemSectionShortcuts";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

const Harness = () => {
	useItemSectionShortcuts({
		enabled: true,
		itemUid: "item-uid",
		projectId: "project-id",
		sections: readSectionsFn(),
	});
	return null;
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	state.navigateFn.mockClear();
});

describe("Item Detail section shortcuts", () => {
	it("navigates every section with a unique unmodified key while leaving E to Edit", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(createElement(HotkeysProvider, null, createElement(Harness)));
		});

		const expected = [
			[
				"i",
				"identity",
			],
			[
				"a",
				"artwork",
			],
			[
				"m",
				"merges",
			],
			[
				"p",
				"production",
			],
			[
				"c",
				"clock",
			],
			[
				"t",
				"automation",
			],
			[
				"h",
				"chain",
			],
			[
				"o",
				"connections",
			],
			[
				"n",
				"notes",
			],
			[
				"d",
				"delete",
			],
		] as const;

		for (const [key, sectionId] of expected) {
			const event = new KeyboardEvent("keydown", {
				bubbles: true,
				cancelable: true,
				key,
			});
			await act(async () => document.dispatchEvent(event));
			expect(event.defaultPrevented).toBe(true);
			expect(state.navigateFn).toHaveBeenLastCalledWith({
				to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
				params: {
					itemUid: "item-uid",
					projectId: "project-id",
					sectionId,
				},
			});
		}

		const callsBeforeEdit = state.navigateFn.mock.calls.length;
		await act(async () =>
			document.dispatchEvent(
				new KeyboardEvent("keydown", {
					bubbles: true,
					cancelable: true,
					key: "e",
				}),
			),
		);
		expect(state.navigateFn).toHaveBeenCalledTimes(callsBeforeEdit);
	});

	it("does not navigate while typing", async () => {
		const container = document.createElement("div");
		const input = document.createElement("input");
		document.body.append(container, input);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(createElement(HotkeysProvider, null, createElement(Harness)));
		});

		await act(async () =>
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					bubbles: true,
					cancelable: true,
					key: "c",
				}),
			),
		);

		expect(state.navigateFn).not.toHaveBeenCalled();
	});
});
