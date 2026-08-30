// @vitest-environment jsdom

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	afterEachSpotlightTest,
	beforeEachSpotlightTest,
	changeSearchQuery,
	readSearchInput,
	renderSpotlight,
	spotlightState,
	toggleSpotlight,
} from "./CheatItemSpotlight.test/harness";

beforeEach(beforeEachSpotlightTest);
afterEach(afterEachSpotlightTest);

describe("CheatItemSpotlight command lifecycle", () => {
	it("keeps spotlight interaction available while a spawn is pending", async () => {
		const { container } = await renderSpotlight();
		await toggleSpotlight();
		spotlightState.mode = "pending";
		const spawnInput = readSearchInput(container);
		await act(async () => {
			spawnInput.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(readSearchInput(container).readOnly).toBe(false);
		expect(
			container
				.querySelector('[data-ui="CheatItemSpotlightStatus"]')
				?.getAttribute("data-status"),
		).toBe("pending");

		await toggleSpotlight();
		expect(container.querySelector('[data-ui="CheatItemSpotlight"]')).toBeNull();
		await toggleSpotlight();
		const reopenedInput = readSearchInput(container);
		expect(reopenedInput.readOnly).toBe(false);
		expect(
			container
				.querySelector('[data-ui="CheatItemSpotlightStatus"]')
				?.getAttribute("data-status"),
		).toBe("pending");
		await changeSearchQuery(reopenedInput, "beta");
		expect(reopenedInput.value).toBe("beta");
		expect(
			Array.from(container.querySelectorAll<HTMLButtonElement>("button")).every(
				(button) => button.disabled,
			),
		).toBe(false);
	});

	it("shows a spawn completed while closed exactly once on reopen", async () => {
		const { container } = await renderSpotlight();
		await toggleSpotlight();
		spotlightState.mode = "pending";
		const input = readSearchInput(container);
		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		await toggleSpotlight();
		const complete = spotlightState.complete;
		if (complete === undefined) throw new Error("Expected pending spawn completion.");
		await act(async () => {
			complete();
			await Promise.resolve();
		});
		await toggleSpotlight();
		expect(readSearchInput(container).readOnly).toBe(false);
		expect(
			container
				.querySelector('[data-ui="CheatItemSpotlightStatus"]')
				?.getAttribute("data-status"),
		).toBe("success");

		await toggleSpotlight();
		await toggleSpotlight();
		expect(
			container
				.querySelector('[data-ui="CheatItemSpotlightStatus"]')
				?.getAttribute("data-status"),
		).toBe("idle");
	});

	it("retains spawn admission while the Board-local Spotlight unmounts and remounts", async () => {
		const { container, render } = await renderSpotlight();
		await toggleSpotlight();
		spotlightState.mode = "pending";
		const input = readSearchInput(container);
		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(spotlightState.spawn).toHaveBeenCalledOnce();

		await render(false);
		await render(true);
		await toggleSpotlight();
		const remounted = readSearchInput(container);
		expect(remounted.readOnly).toBe(false);
		await act(async () => {
			remounted.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(spotlightState.spawn).toHaveBeenCalledTimes(2);
	});
});
