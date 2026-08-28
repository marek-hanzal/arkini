// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GamePage } from "~/page/game/GamePage";

const pageState = vi.hoisted(() => ({
	navigate: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tanstack/react-router", () => ({
	getRouteApi: () => ({
		useParams: () => ({
			packageId: "package-game-page",
		}),
	}),
	useNavigate: () => pageState.navigate,
}));

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

describe("GamePage", () => {
	it("opens Inventory within the exact installed package", async () => {
		const host = document.createElement("div");
		document.body.append(host);
		const root = createRoot(host);
		roots.push(root);
		await act(async () => root.render(createElement(GamePage)));

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
