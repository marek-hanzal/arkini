// @vitest-environment jsdom

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	afterEachSpotlightTest,
	beforeEachSpotlightTest,
	changeSearchQuery,
	readSearchInput,
	renderSpotlight,
	setCheatAvailability,
	spotlightState,
	toggleSpotlight,
} from "./CheatItemSpotlight.test/harness";

beforeEach(beforeEachSpotlightTest);
afterEach(afterEachSpotlightTest);

describe("CheatItemSpotlight", () => {
	it("allows an editor-owned override of the global player preference", async () => {
		setCheatAvailability(false);
		const { container } = await renderSpotlight({
			alwaysAvailable: true,
		});

		await toggleSpotlight();

		expect(container.querySelector('[data-ui="CheatItemSpotlight"]')).not.toBeNull();
	});

	it("opens through Mod+P and spawns the keyboard-selected catalog item", async () => {
		const onBeforeOpenFn = vi.fn(() => {
			expect(document.querySelector('[data-ui="CheatItemSpotlight"]')).toBeNull();
		});
		const { container } = await renderSpotlight({
			onBeforeOpenFn,
		});
		const previousFocus = document.createElement("button");
		document.body.append(previousFocus);
		previousFocus.focus();

		await toggleSpotlight();
		expect(onBeforeOpenFn).toHaveBeenCalledOnce();
		const input = readSearchInput(container);
		expect(document.activeElement).toBe(input);
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
				container.querySelector<HTMLButtonElement>('button[data-ui-selected="true"]')
					?.dataset.itemId,
			).toBe("item:beta"),
		);
		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(spotlightState.spawn).toHaveBeenCalledWith("item:beta");

		const selectedOption = container.querySelector<HTMLButtonElement>(
			'button[data-ui-selected="true"]',
		);
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
		expect(document.activeElement).toBe(previousFocus);
	});

	it("admits every same-tick keyboard and pointer spawn action", async () => {
		const { container } = await renderSpotlight();
		await toggleSpotlight();
		const input = readSearchInput(container);
		const selected = container.querySelector<HTMLButtonElement>(
			'[data-ui="CheatItemSpotlightResults"] button[data-ui-selected="true"]',
		);
		if (selected === null) throw new Error("Expected selected Spotlight result.");

		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					cancelable: true,
				}),
			);
			selected.click();
		});

		expect(spotlightState.spawn).toHaveBeenCalledTimes(2);
	});

	it("searches the authoritative catalog by shared Fuse terms", async () => {
		const { container } = await renderSpotlight();
		await toggleSpotlight();
		await changeSearchQuery(readSearchInput(container), "item:beta");

		const options = Array.from(
			container.querySelectorAll<HTMLButtonElement>(
				'[data-ui="CheatItemSpotlightResults"] button',
			),
		);
		expect(options).toHaveLength(1);
		expect(options[0]?.dataset.itemId).toBe("item:beta");
	});
});
