// @vitest-environment jsdom

import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { buttonByText, linkByText, renderSettings } from "./Settings.test/fixture";

describe("Settings", () => {
	it("routes section tabs without adding Settings pages to Back history", async () => {
		const { container, router } = await renderSettings([
			"/main-menu",
			"/settings",
		]);

		expect(router.state.location.pathname).toBe("/settings/common");
		expect(container.querySelector('[data-ui="SettingsCommon"]')).not.toBeNull();
		await act(async () => linkByText(container, "Game").click());
		expect(router.state.location.pathname).toBe("/settings/game");
		expect(container.querySelector('[data-ui="SettingsGame"]')).not.toBeNull();
		await act(async () => linkByText(container, "Dev").click());
		expect(router.state.location.pathname).toBe("/settings/dev");
		expect(container.querySelector('[data-ui="SettingsDev"]')).not.toBeNull();

		await act(async () => buttonByText(container, "Back").click());
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/main-menu"));
	});

	it("loads developer capabilities only after the Dev section mounts", async () => {
		const { container, readCliStatus } = await renderSettings([
			"/settings/common",
		]);

		await act(async () => Promise.resolve());
		expect(readCliStatus).not.toHaveBeenCalled();

		await act(async () => linkByText(container, "Dev").click());
		await vi.waitFor(() => expect(readCliStatus).toHaveBeenCalledOnce());
	});

	it("changes and persists the authoritative theme, then returns through history with Escape", async () => {
		const { container, deferred, router, write } = await renderSettings([
			"/main-menu",
			"/settings",
		]);

		const radios = Array.from(container.querySelectorAll('input[name="appearance-theme"]'));
		expect(radios).toHaveLength(3);
		const light = radios.find(
			(input) => input instanceof HTMLInputElement && input.value === "light",
		);
		if (!(light instanceof HTMLInputElement)) throw new Error("Expected Light theme radio.");
		expect(document.documentElement.dataset.theme).toBe("dark");
		await act(async () => light.click());
		expect(document.documentElement.dataset.theme).toBe("light");
		expect(write).toHaveBeenCalledOnce();
		expect(write).toHaveBeenCalledWith("light");
		const fieldset = container.querySelector("fieldset");
		expect(fieldset).toBeInstanceOf(HTMLFieldSetElement);
		expect((fieldset as HTMLFieldSetElement).disabled).toBe(true);
		await act(async () => deferred.resolve());
		await act(async () => {
			await vi.waitFor(() => expect((fieldset as HTMLFieldSetElement).disabled).toBe(false));
		});
		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true,
				}),
			);
			await Promise.resolve();
		});
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/main-menu"));
	});

	it("returns to the exact game route through the Back action", async () => {
		const { container, router } = await renderSettings([
			"/game/package:menu",
			"/settings",
		]);

		await act(async () => buttonByText(container, "Back").click());
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/game/package:menu"));
	});

	it("falls back to the main menu when Settings was opened directly", async () => {
		const { container, router } = await renderSettings([
			"/settings",
		]);

		await act(async () => buttonByText(container, "Back").click());
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/main-menu"));
	});

	it("deduplicates same-tick exits and releases the action after rejected navigation", async () => {
		const { container, router } = await renderSettings([
			"/settings",
		]);
		const navigate = vi
			.spyOn(router, "navigate")
			.mockRejectedValueOnce(new Error("settings navigation rejected"));
		const button = buttonByText(container, "Back");

		await act(async () => {
			button.click();
			button.click();
			await Promise.resolve();
		});

		expect(navigate).toHaveBeenCalledTimes(1);
		expect(container.textContent).toContain("Navigation failed: settings navigation rejected");
		expect(button.disabled).toBe(false);

		await act(async () => button.click());
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/main-menu"));
		expect(navigate).toHaveBeenCalledTimes(2);
	});
});
