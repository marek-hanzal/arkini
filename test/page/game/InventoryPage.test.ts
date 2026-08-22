// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InventoryPage } from "~/page/game/InventoryPage";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const pageState = vi.hoisted(() => ({
	detailOpen: false,
	menuOpen: false,
	onClose: vi.fn(),
}));

vi.mock("~/ui/game-menu/useGameMenuControl", () => ({
	useGameMenuControl: () => ({
		isOpen: pageState.menuOpen,
	}),
}));

vi.mock("~/ui/item-detail/useItemDetailControl", () => ({
	useItemDetailControl: () => ({
		isOpen: pageState.detailOpen,
	}),
}));

vi.mock("~/ui/inventory/Inventory", async () => {
	const { createElement: createReactElement } = await import("react");
	return {
		Inventory: ({ onClose }: { readonly onClose: () => void }) =>
			createReactElement(
				"button",
				{
					"data-ui": "InventoryRouteClose",
					onClick: onClose,
					type: "button",
				},
				"Close",
			),
	};
});

const roots: Array<ReturnType<typeof createRoot>> = [];

const renderPage = async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () =>
		root.render(
			createElement(InventoryPage, {
				onClose: pageState.onClose,
			}),
		),
	);
	return host;
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	pageState.detailOpen = false;
	pageState.menuOpen = false;
	pageState.onClose.mockClear();
	document.body.replaceChildren();
});

describe("InventoryPage", () => {
	it("returns the close button and unclaimed navigation keys deterministically to the Board", async () => {
		const host = await renderPage();
		const close = host.querySelector<HTMLButtonElement>('[data-ui="InventoryRouteClose"]');
		if (close === null) throw new Error("Inventory close control is missing.");

		await act(async () => close.click());
		expect(pageState.onClose).toHaveBeenCalledOnce();

		pageState.onClose.mockClear();
		const escape = new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			key: "Escape",
		});
		await act(async () => window.dispatchEvent(escape));
		expect(escape.defaultPrevented).toBe(true);
		expect(pageState.onClose).toHaveBeenCalledOnce();

		pageState.onClose.mockClear();
		const inventoryShortcut = new KeyboardEvent("keydown", {
			cancelable: true,
			key: "i",
		});
		await act(async () => window.dispatchEvent(inventoryShortcut));
		expect(inventoryShortcut.defaultPrevented).toBe(true);
		expect(pageState.onClose).toHaveBeenCalledOnce();
	});

	it("leaves navigation keys to higher-priority Game Menu and Item Detail owners", async () => {
		pageState.detailOpen = true;
		await renderPage();
		const detailEscape = new KeyboardEvent("keydown", {
			cancelable: true,
			key: "Escape",
		});
		window.dispatchEvent(detailEscape);
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				cancelable: true,
				key: "i",
			}),
		);
		expect(detailEscape.defaultPrevented).toBe(false);
		expect(pageState.onClose).not.toHaveBeenCalled();

		const root = roots.pop();
		if (root === undefined) throw new Error("Inventory page root is missing.");
		await act(async () => root.unmount());
		pageState.detailOpen = false;
		pageState.menuOpen = true;
		await renderPage();
		const menuEscape = new KeyboardEvent("keydown", {
			cancelable: true,
			key: "Escape",
		});
		window.dispatchEvent(menuEscape);
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				cancelable: true,
				key: "i",
			}),
		);
		expect(menuEscape.defaultPrevented).toBe(false);
		expect(pageState.onClose).not.toHaveBeenCalled();
	});

	it("does not hijack modified, repeated, or editable i key input", async () => {
		const host = await renderPage();
		const input = document.createElement("input");
		host.append(input);

		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				ctrlKey: true,
				key: "i",
			}),
		);
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "i",
				repeat: true,
			}),
		);
		input.dispatchEvent(
			new KeyboardEvent("keydown", {
				bubbles: true,
				key: "i",
			}),
		);

		expect(pageState.onClose).not.toHaveBeenCalled();
	});
});
