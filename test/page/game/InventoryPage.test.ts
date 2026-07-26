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
	navigate: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => pageState.navigate,
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
				packageId: "package-inventory",
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
	pageState.navigate.mockClear();
	document.body.replaceChildren();
});

describe("InventoryPage", () => {
	it("returns the close button and unclaimed Escape deterministically to the Board", async () => {
		const host = await renderPage();
		const close = host.querySelector<HTMLButtonElement>('[data-ui="InventoryRouteClose"]');
		if (close === null) throw new Error("Inventory close control is missing.");

		await act(async () => close.click());
		expect(pageState.navigate).toHaveBeenCalledWith({
			to: "/game/$packageId/board",
			params: {
				packageId: "package-inventory",
			},
			replace: true,
		});

		pageState.navigate.mockClear();
		const escape = new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			key: "Escape",
		});
		await act(async () => window.dispatchEvent(escape));
		expect(escape.defaultPrevented).toBe(true);
		expect(pageState.navigate).toHaveBeenCalledOnce();
	});

	it("leaves Escape to higher-priority Game Menu and Item Detail owners", async () => {
		pageState.detailOpen = true;
		await renderPage();
		const detailEscape = new KeyboardEvent("keydown", {
			cancelable: true,
			key: "Escape",
		});
		window.dispatchEvent(detailEscape);
		expect(detailEscape.defaultPrevented).toBe(false);
		expect(pageState.navigate).not.toHaveBeenCalled();

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
		expect(menuEscape.defaultPrevented).toBe(false);
		expect(pageState.navigate).not.toHaveBeenCalled();
	});
});
