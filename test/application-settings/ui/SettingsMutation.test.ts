// @vitest-environment jsdom

import { RouterProvider } from "@tanstack/react-router";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { AppearanceAtom } from "~/application-settings/atom/AppearanceAtom";
import { CheatAvailabilityAtom } from "~/application-settings/atom/CheatAvailabilityAtom";
import { WindowModeAtom } from "~/window-mode/atom/WindowModeAtom";
import {
	buttonByText,
	linkByText,
	registries,
	renderSettings,
	roots,
	settingsOptionByValue,
} from "./Settings.test/fixture";

describe("Settings mutation authority", () => {
	it("toggles application-wide Cheat tools without an active Game", async () => {
		const { container, writeCheatAvailability, registry } = await renderSettings([
			"/settings/game",
		]);
		const toggle = container.querySelector<HTMLInputElement>(
			'[data-ui="SettingsCheatAvailability"] input[type="checkbox"]',
		);
		if (toggle === null) throw new Error("Expected Cheat tools control.");
		await act(async () => toggle.click());
		await vi.waitFor(() => expect(writeCheatAvailability).toHaveBeenCalledWith(true));
		await vi.waitFor(() => expect(registry.get(CheatAvailabilityAtom)).toBe(true));
	});

	it("applies Electron-confirmed window modes", async () => {
		const { container, registry, writeWindowMode } = await renderSettings([
			"/settings",
		]);
		const options = container.querySelector<HTMLElement>(
			'[data-ui="SettingsWindowModeOptions"]',
		);
		if (options === null) throw new Error("Expected Window mode control.");
		const choices = Array.from(
			options.querySelectorAll<HTMLButtonElement>(
				'[data-ui="SettingsSegmentedChoiceOption"]',
			),
		);
		expect(choices.map((choice) => choice.dataset.uiValue)).toEqual([
			"default",
			"bordered",
			"fullscreen",
		]);
		expect(choices[0]?.dataset.uiSelected).toBe("true");
		const fullscreen = settingsOptionByValue(
			container,
			"SettingsWindowModeOptions",
			"fullscreen",
		);

		await act(async () => fullscreen.click());

		await vi.waitFor(() => expect(writeWindowMode).toHaveBeenCalledWith("fullscreen"));
		await vi.waitFor(() => expect(registry.get(WindowModeAtom)).toBe("fullscreen"));
	});

	it("keeps one settings mutation authoritative while routed sections change", async () => {
		const { container, deferred, write, writeCheatAvailability } = await renderSettings([
			"/settings",
		]);
		const light = settingsOptionByValue(container, "SettingsThemeOptions", "light");

		await act(async () => light.click());
		expect(write).toHaveBeenCalledOnce();
		await act(async () => linkByText(container, "Game").click());
		const toggle = container.querySelector<HTMLInputElement>(
			'[data-ui="SettingsCheatAvailability"] input[type="checkbox"]',
		);
		if (toggle === null) throw new Error("Expected Cheat tools control.");
		expect(toggle.disabled).toBe(true);
		await act(async () => toggle.click());
		expect(writeCheatAvailability).not.toHaveBeenCalled();

		await act(async () => deferred.resolve());
		await vi.waitFor(() => expect(container.textContent).toContain("Theme saved."));
		await act(async () => toggle.click());
		await vi.waitFor(() => expect(writeCheatAvailability).toHaveBeenCalledOnce());
	});

	it("blocks same-tick Back admission until the settings mutation settles", async () => {
		const { container, deferred, router, write } = await renderSettings([
			"/main-menu",
			"/settings",
		]);
		const light = settingsOptionByValue(container, "SettingsThemeOptions", "light");
		const back = buttonByText(container, "Back");

		await act(async () => {
			light.click();
			back.click();
		});

		expect(write).toHaveBeenCalledOnce();
		expect(router.state.location.pathname).toBe("/settings/common");

		await act(async () => deferred.resolve());
		await vi.waitFor(() => expect(back.disabled).toBe(false));
		await act(async () => back.click());
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/main-menu"));
	});

	it("releases the command authority after a failed write", async () => {
		const { container, deferred, writeCheatAvailability } = await renderSettings([
			"/settings",
		]);
		const light = settingsOptionByValue(container, "SettingsThemeOptions", "light");

		await act(async () => light.click());
		await act(async () => deferred.reject(new Error("theme write rejected")));
		await vi.waitFor(() => expect(container.textContent).toContain("Theme update failed:"));

		await act(async () => linkByText(container, "Game").click());
		const toggle = container.querySelector<HTMLInputElement>(
			'[data-ui="SettingsCheatAvailability"] input[type="checkbox"]',
		);
		if (toggle === null) throw new Error("Expected Cheat tools control.");
		expect(toggle.matches(":disabled")).toBe(false);
		await act(async () => toggle.click());
		await vi.waitFor(() => expect(writeCheatAvailability).toHaveBeenCalledOnce());
	});

	it("keeps one pending command authoritative across a React remount", async () => {
		const { container, deferred, registry, root, router, write, writeCheatAvailability } =
			await renderSettings([
				"/main-menu",
				"/settings",
			]);
		const light = settingsOptionByValue(container, "SettingsThemeOptions", "light");

		await act(async () => light.click());
		expect(write).toHaveBeenCalledOnce();

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		const remountedRoot = createRoot(container);
		roots.push(remountedRoot);
		await act(async () => {
			remountedRoot.render(
				createElement(RouterProvider, {
					router,
				}),
			);
		});

		await act(async () => linkByText(container, "Game").click());
		const toggle = container.querySelector<HTMLInputElement>(
			'[data-ui="SettingsCheatAvailability"] input[type="checkbox"]',
		);
		const back = buttonByText(container, "Back");
		if (toggle === null) throw new Error("Expected Cheat tools control.");
		expect(toggle.matches(":disabled")).toBe(true);
		expect(back.disabled).toBe(true);
		expect(registry.get(AppearanceAtom).theme).toBe("light");

		await act(async () => {
			toggle.click();
			back.click();
		});
		expect(writeCheatAvailability).not.toHaveBeenCalled();
		expect(router.state.location.pathname).toBe("/settings/game");
		expect(registry.get(AppearanceAtom).theme).toBe("light");

		await act(async () => deferred.resolve());
		await vi.waitFor(() => expect(container.textContent).toContain("Theme saved."));
		expect(back.disabled).toBe(false);
		await act(async () => toggle.click());
		await vi.waitFor(() => expect(writeCheatAvailability).toHaveBeenCalledOnce());
	});

	it("allows registry disposal before React cleans up a pending settings command", async () => {
		const { container, registry, root, write } = await renderSettings([
			"/settings",
		]);
		const light = settingsOptionByValue(container, "SettingsThemeOptions", "light");

		await act(async () => light.click());
		expect(write).toHaveBeenCalledOnce();

		registry.dispose();
		registries.splice(registries.indexOf(registry), 1);
		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);

		expect(registry.getNodes().size).toBe(0);
	});

	it("toggles application-wide Cheat tools without mutating the current Game", async () => {
		const { container, game, writeCheatAvailability, registry } = await renderSettings(
			[
				"/game/package:settings/board",
				"/settings/game",
			],
			{
				activeGame: true,
			},
		);
		if (game === null) throw new Error("Expected active Game.");
		const toggle = container.querySelector<HTMLInputElement>(
			'[data-ui="SettingsCheatAvailability"] input[type="checkbox"]',
		);
		if (toggle === null) throw new Error("Expected Cheat tools control.");
		expect(toggle.checked).toBe(false);
		await act(async () => toggle.click());
		await vi.waitFor(() => expect(writeCheatAvailability).toHaveBeenCalledWith(true));
		await vi.waitFor(() => expect(registry.get(CheatAvailabilityAtom)).toBe(true));
		expect(game.getSnapshot().cheats).toEqual({
			enabled: false,
			everEnabled: false,
			instantGameplay: false,
		});
	});
});
