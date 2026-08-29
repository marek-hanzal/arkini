// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Route as GameBoardRouteDefinition } from "~/@routes/game/$packageId/_scene/board";

const pageState = vi.hoisted(() => ({
	navigate: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: object) => ({
		options,
		useParams: () => ({
			packageId: "package-game-page",
		}),
	}),
	useNavigate: () => pageState.navigate,
}));

const GameBoardRoute = GameBoardRouteDefinition.options.component;
if (GameBoardRoute === undefined)
	throw new Error("Installed Game Board route component is missing.");

vi.mock("~/ui/game/PlayableBoard", async () => {
	const { createElement: createReactElement } = await import("react");
	return {
		PlayableBoard: ({ onOpenInventory }: { readonly onOpenInventory: () => void }) =>
			createReactElement(
				"button",
				{
					onClick: onOpenInventory,
					type: "button",
				},
				"Inventory",
			),
	};
});

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	pageState.navigate.mockClear();
	document.body.replaceChildren();
});

describe("installed Game Board route", () => {
	it("opens Inventory within the exact installed package", async () => {
		const host = document.createElement("div");
		document.body.append(host);
		const root = createRoot(host);
		roots.push(root);
		await act(async () => root.render(createElement(GameBoardRoute)));

		const inventory = host.querySelector("button");
		if (inventory === null) throw new Error("Inventory control is missing.");
		await act(async () => inventory.click());

		expect(pageState.navigate).toHaveBeenCalledWith({
			to: "/game/$packageId/inventory",
			params: {
				packageId: "package-game-page",
			},
		});
	});
});
