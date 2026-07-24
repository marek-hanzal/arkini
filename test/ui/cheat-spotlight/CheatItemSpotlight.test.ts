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
	pending: false,
	listeners: new Set<() => void>(),
	reset: vi.fn(),
	spawn: vi.fn(),
	publishPending: (pending: boolean) => {
		state.pending = pending;
		for (const listener of state.listeners) listener();
	},
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
vi.mock("~/bridge/cheat/useSpawnCheatItemMutation", async () => {
	const { useSyncExternalStore } = await import("react");
	return {
		useSpawnCheatItemMutation: () => ({
			isPending: useSyncExternalStore(
				(listener) => {
					state.listeners.add(listener);
					return () => state.listeners.delete(listener);
				},
				() => state.pending,
				() => state.pending,
			),
			isError: false,
			isSuccess: false,
			error: null,
			mutate: state.spawn,
			reset: state.reset,
		}),
	};
});
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
	state.pending = false;
	state.listeners.clear();
	state.reset.mockReset();
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
		const onBeforeOpen = vi.fn(() => {
			expect(container.querySelector('[data-ui="CheatItemSpotlight"]')).toBeNull();
		});
		await act(async () => {
			root.render(
				createElement(
					CheatAvailabilityProvider,
					{
						availability,
					},
					createElement(CheatItemSpotlight, {
						game: {} as Game,
						onBeforeOpen,
					}),
				),
			);
		});
		const origin = document.createElement("button");
		document.body.append(origin);
		origin.focus();

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
		expect(onBeforeOpen).toHaveBeenCalledOnce();
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
		const options = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
		const lastOption = options.at(-1);
		if (lastOption === undefined) throw new Error("Expected Spotlight options.");
		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Tab",
					shiftKey: true,
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(document.activeElement).toBe(lastOption);
		await act(async () => {
			lastOption.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Tab",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(document.activeElement).toBe(input);
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

		selectedOption?.focus();
		await act(async () => {
			selectedOption?.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(container.querySelector('[data-ui="CheatItemSpotlight"]')).toBeNull();
		expect(document.activeElement).toBe(origin);
		expect(container.querySelector('[role="dialog"][aria-modal="true"]')).toBeNull();
	});
	it("retains pending spawn ownership across close, reopen and query attempts", async () => {
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
		const toggle = async () => {
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
		};

		await toggle();
		expect(state.reset).toHaveBeenCalledTimes(1);
		await act(async () => state.publishPending(true));
		const pendingInput = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (pendingInput === null) throw new Error("Expected pending Spotlight search input.");
		expect(pendingInput.readOnly).toBe(true);
		expect(pendingInput.className).toContain("cursor-progress");

		await toggle();
		expect(container.querySelector('[data-ui="CheatItemSpotlight"]')).toBeNull();
		expect(state.reset).toHaveBeenCalledTimes(1);

		await toggle();
		const reopenedInput = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (reopenedInput === null) throw new Error("Expected reopened Spotlight search input.");
		expect(reopenedInput.readOnly).toBe(true);
		expect(state.reset).toHaveBeenCalledTimes(1);
		await vi.waitFor(() => expect(document.activeElement).toBe(reopenedInput));

		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
		if (setter === undefined) throw new Error("Expected native input setter.");
		await act(async () => {
			setter.call(reopenedInput, "beta");
			reopenedInput.dispatchEvent(
				new Event("input", {
					bubbles: true,
				}),
			);
		});
		expect(reopenedInput.value).toBe("");
		expect(state.reset).toHaveBeenCalledTimes(1);
		expect(
			Array.from(container.querySelectorAll<HTMLButtonElement>("button")).every(
				(button) => button.disabled,
			),
		).toBe(true);

		await toggle();
		await act(async () => state.publishPending(false));
		await toggle();
		expect(state.reset).toHaveBeenCalledTimes(1);
		expect(container.querySelector<HTMLInputElement>('input[type="search"]')?.readOnly).toBe(
			false,
		);

		await toggle();
		await toggle();
		expect(state.reset).toHaveBeenCalledTimes(2);
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
