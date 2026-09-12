// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { ItemSpotlight } from "~/ui/ui/ItemSpotlight";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it("keeps keyboard-selected results visible without moving focus or the outer page", async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const selectFn = vi.fn();
	try {
		await act(async () => {
			root.render(
				<ItemSpotlight
					dataUi="TestSpotlight"
					emptyMessage="No results"
					onCloseFn={() => undefined}
					onSelectItemFn={selectFn}
					options={["alpha", "beta", "gamma"].map((id) => ({
						artwork: <span />,
						itemId: id,
						label: id,
						secondary: id,
						terms: [
							id,
						],
					}))}
					placement="viewport"
				/>,
			);
		});
		const input = container.querySelector("input")!;
		const menu = container.querySelector<HTMLDivElement>('[data-ui="TestSpotlightResults"]')!;
		const rows = [
			...menu.querySelectorAll("button"),
		];
		Object.defineProperty(menu, "clientHeight", {
			value: 100,
		});
		menu.getBoundingClientRect = () =>
			({
				top: 200,
			}) as DOMRect;
		rows.forEach((row, index) => {
			row.getBoundingClientRect = () =>
				({
					top: 200 + index * 80 - menu.scrollTop,
					bottom: 280 + index * 80 - menu.scrollTop,
				}) as DOMRect;
		});
		container.scrollTop = 37;
		const pressFn = async (key: string) => {
			await act(async () => {
				input.dispatchEvent(
					new KeyboardEvent("keydown", {
						key,
						bubbles: true,
						cancelable: true,
					}),
				);
			});
		};
		await pressFn("ArrowDown");
		expect(menu.scrollTop).toBe(60);
		await pressFn("ArrowDown");
		expect(menu.scrollTop).toBe(140);
		await pressFn("ArrowDown");
		expect(menu.scrollTop).toBe(0);
		await pressFn("ArrowUp");
		expect(menu.scrollTop).toBe(140);
		expect(document.activeElement).toBe(input);
		expect(container.scrollTop).toBe(37);
		await pressFn("Enter");
		expect(selectFn).toHaveBeenCalledWith("gamma");
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});
