// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Route as GameInventoryRouteDefinition } from "~/@routes/game/$packageId/_scene/inventory";

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
	createFileRoute: () => (options: object) => ({
		options,
		useParams: () => ({
			packageId: "package-inventory-page",
		}),
	}),
	useNavigate: () => pageState.navigate,
}));

const GameInventoryRoute = GameInventoryRouteDefinition.options.component;
if (GameInventoryRoute === undefined)
	throw new Error("Installed Game Inventory route component is missing.");

vi.mock("~/game-menu/ui/GameMenuProvider", () => ({
	useGameMenuControl: () => ({
		phase: pageState.menuOpen ? "open" : "closed",
	}),
}));

vi.mock("~/item-detail-frame/ui/useItemDetailControl", () => ({
	useItemDetailControl: () => ({
		state: {
			phase: pageState.detailOpen ? "open" : "closed",
		},
	}),
}));

vi.mock("~/game-shell/ui/Inventory", async () => {
	const { createElement: createReactElement } = await import("react");
	return {
		Inventory: ({ onCloseFn }: { readonly onCloseFn: () => void }) =>
			createReactElement(
				"button",
				{
					"data-ui": "InventoryRouteClose",
					onClick: onCloseFn,
					type: "button",
				},
				"Close",
			),
	};
});

const roots: Array<ReturnType<typeof createRoot>> = [];

const renderRoute = async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () => root.render(createElement(GameInventoryRoute)));
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

describe("installed Game Inventory route", () => {
	it("returns the close button and unclaimed navigation keys deterministically to the Board", async () => {
		const host = await renderRoute();
		const close = host.querySelector<HTMLButtonElement>('[data-ui="InventoryRouteClose"]');
		if (close === null) throw new Error("Inventory close control is missing.");

		await act(async () => close.click());
		expect(pageState.navigate).toHaveBeenCalledWith({
			to: "/game/$packageId/board",
			params: {
				packageId: "package-inventory-page",
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

		pageState.navigate.mockClear();
		const inventoryShortcut = new KeyboardEvent("keydown", {
			cancelable: true,
			key: "i",
		});
		await act(async () => window.dispatchEvent(inventoryShortcut));
		expect(inventoryShortcut.defaultPrevented).toBe(true);
		expect(pageState.navigate).toHaveBeenCalledOnce();
	});

	it("leaves navigation keys to higher-priority Game Menu and Item Detail owners", async () => {
		pageState.detailOpen = true;
		await renderRoute();
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
		expect(pageState.navigate).not.toHaveBeenCalled();

		const root = roots.pop();
		if (root === undefined) throw new Error("Inventory page root is missing.");
		await act(async () => root.unmount());
		pageState.detailOpen = false;
		pageState.menuOpen = true;
		await renderRoute();
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
		expect(pageState.navigate).not.toHaveBeenCalled();
	});

	it("does not hijack modified, repeated, or editable i key input", async () => {
		const host = await renderRoute();
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

		expect(pageState.navigate).not.toHaveBeenCalled();
	});
});
