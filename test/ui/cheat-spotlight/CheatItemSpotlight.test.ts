// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCheatAvailability } from "~/bridge/cheat/createCheatAvailability";
import type { Game } from "~/bridge/game/Game";
import { CheatAvailabilityProvider } from "~/ui/cheat-availability/CheatAvailabilityProvider";
import { CheatItemSpotlight } from "~/ui/cheat-spotlight/CheatItemSpotlight";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	spawn: vi.fn(),
}));

vi.mock("~/bridge/cheat/useGameCheats", () => ({
	useGameCheats: () => ({
		enabled: true,
		everEnabled: true,
		instantGameplay: false,
	}),
}));
vi.mock("~/bridge/cheat/useCheatItemCatalog", () => ({
	useCheatItemCatalog: () => [
		{
			itemId: "item:alpha",
			title: "Alpha",
			categoryId: "resource",
			tags: [],
			sourceResourceId: "alpha",
			sourceUrl: "blob:alpha",
		},
		{
			itemId: "item:beta",
			title: "Beta",
			categoryId: "resource",
			tags: [
				"timber",
			],
			sourceResourceId: "beta",
			sourceUrl: "blob:beta",
		},
	],
}));
vi.mock("~/bridge/cheat/useSpawnCheatItemMutation", () => ({
	useSpawnCheatItemMutation: () => ({
		isPending: false,
		isError: false,
		isSuccess: false,
		error: null,
		mutate: state.spawn,
		reset: vi.fn(),
	}),
}));
vi.mock("~/ui/game-menu/useGameMenuControl", () => ({
	useGameMenuControl: () => ({
		isOpen: false,
	}),
}));
vi.mock("~/ui/item-detail/useItemDetailControl", () => ({
	useItemDetailControl: () => ({
		isOpen: false,
	}),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	state.spawn.mockReset();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("CheatItemSpotlight", () => {
	it("opens through TanStack Mod+P and spawns the keyboard-selected catalog item", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const availability = createCheatAvailability();
		availability.apply(true);
		await act(async () => {
			root.render(
				createElement(
					CheatAvailabilityProvider,
					{
						availability,
					},
					createElement(CheatItemSpotlight, {
						game: {} as Game,
					}),
				),
			);
		});

		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "p",
					code: "KeyP",
					ctrlKey: true,
					bubbles: true,
					cancelable: true,
				}),
			);
			await Promise.resolve();
		});
		const input = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (input === null) throw new Error("Expected Spotlight search input.");
		await vi.waitFor(() => expect(document.activeElement).toBe(input));

		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "ArrowDown",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		await vi.waitFor(() =>
			expect(
				container.querySelector<HTMLButtonElement>('button[data-selected="true"]')
					?.textContent,
			).toContain("Beta"),
		);
		const selectedOption = container.querySelector<HTMLButtonElement>(
			'button[data-selected="true"]',
		);
		expect(selectedOption?.className).toContain("ak-spotlight-option");
		expect(selectedOption?.className).not.toContain("ak-list-row");
		expect(selectedOption?.querySelectorAll(".ak-spotlight-option-secondary")).toHaveLength(2);
		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(state.spawn).toHaveBeenCalledWith("item:beta");

		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(container.querySelector('[data-ui="CheatItemSpotlight"]')).toBeNull();
	});
	it("searches the authoritative catalog by shared Fuse terms", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const availability = createCheatAvailability();
		availability.apply(true);
		await act(async () => {
			root.render(
				createElement(
					CheatAvailabilityProvider,
					{
						availability,
					},
					createElement(CheatItemSpotlight, {
						game: {} as Game,
					}),
				),
			);
		});
		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "p",
					code: "KeyP",
					ctrlKey: true,
					bubbles: true,
					cancelable: true,
				}),
			);
			await Promise.resolve();
		});
		const input = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (input === null) throw new Error("Expected Spotlight search input.");
		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
		if (setter === undefined) throw new Error("Expected native input setter.");
		await act(async () => {
			setter.call(input, "timber");
			input.dispatchEvent(
				new Event("input", {
					bubbles: true,
				}),
			);
		});

		const options = Array.from(
			container.querySelectorAll<HTMLButtonElement>(
				'[data-ui="CheatItemSpotlightResults"] button',
			),
		);
		expect(options).toHaveLength(1);
		expect(options[0]?.textContent).toContain("Beta");
	});
});
