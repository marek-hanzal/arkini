// @vitest-environment jsdom

import { RegistryContext } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppearanceAtom } from "~/bridge/appearance/AppearanceAtom";
import { CheatAvailabilityAtom } from "~/bridge/cheat/CheatAvailabilityAtom";
import { WindowModeAtom } from "~/bridge/window/WindowModeAtom";
import type { Game } from "~/bridge/game/Game";
import type { GameEngine } from "~/bridge/game/GameEngine";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { SettingsPage } from "~/page/settings/SettingsPage";
import { createTestGameSession } from "~test/bridge/game/createTestGameSession";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import {
	adoptTestGameEngineResourceFx,
	createTestRendererRuntime,
} from "~test/support/createTestRendererRuntime";
import { AppearanceDataset } from "~/ui/appearance/AppearanceDataset";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: Array<ReturnType<typeof AtomRegistry.make>> = [];
const runtimeHarnesses: Array<ReturnType<typeof createTestRendererRuntime>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const runtimeHarness of runtimeHarnesses.splice(0)) {
		await runtimeHarness.rendererRuntime.dispose();
		runtimeHarness.atomRegistry.dispose();
	}
	for (const registry of registries.splice(0)) registry.dispose();
	vi.restoreAllMocks();
	document.body.replaceChildren();
	Reflect.deleteProperty(window, "arkini");
});

const createDeferred = () => {
	let resolve: () => void = () => undefined;
	let reject: (error: unknown) => void = () => undefined;
	const promise = new Promise<void>((complete, fail) => {
		resolve = complete;
		reject = fail;
	});
	return {
		promise,
		reject,
		resolve,
	};
};

const buttonByText = (container: ParentNode, text: string) => {
	const button = Array.from(container.querySelectorAll("button")).find(
		(candidate) => candidate.textContent === text,
	);
	if (!(button instanceof HTMLButtonElement)) throw new Error(`Expected ${text}.`);
	return button;
};

const renderSettings = async (
	initialEntries: ReadonlyArray<string>,
	{
		activeGame = false,
	}: {
		readonly activeGame?: boolean;
	} = {},
) => {
	const deferred = createDeferred();
	const write = vi.fn(() => deferred.promise);
	const writeCheatAvailability = vi.fn(() => Promise.resolve());
	const openDiagnostics = vi.fn(() => Promise.resolve());
	const openUserData = vi.fn(() => Promise.resolve());
	let resolvePortCheck: (value: { readonly type: "available" }) => void = () => undefined;
	const checkEditorMcpPort = vi.fn(
		() =>
			new Promise<{
				readonly type: "available";
			}>((resolve) => {
				resolvePortCheck = resolve;
			}),
	);
	const writeEditorMcpPort = vi.fn(() => Promise.resolve());
	const registry = AtomRegistry.make({
		initialValues: [
			[
				AppearanceAtom,
				{
					theme: "dark",
					accent: "rose",
				},
			],
			[
				WindowModeAtom,
				"default",
			],
		],
	});
	const writeWindowMode = vi.fn((mode: "default" | "bordered" | "fullscreen") => {
		registry.set(WindowModeAtom, mode);
		return Promise.resolve();
	});
	registries.push(registry);
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			editorMcp: {
				readPort: () => Promise.resolve(32_310),
				checkPort: checkEditorMcpPort,
				writePort: writeEditorMcpPort,
			},
			appearance: {
				write,
			},
			cheats: {
				writeAvailable: writeCheatAvailability,
			},
			diagnostics: {
				openDirectory: openDiagnostics,
			},
			userData: {
				openDirectory: openUserData,
			},
			window: {
				writeMode: writeWindowMode,
			},
		},
	});
	let game: GameEngine | null = null;
	if (activeGame) {
		const config = createJobTestConfig();
		const session = await createTestGameSession({
			config,
			tickIntervalMs: 60_000,
		});
		const createdGame: Game = {
			...session,
			arkpack: {
				packageId: "package:settings",
				contentHash: "content:settings",
				gameId: "game:settings",
				title: "Settings game",
				game: "1.0",
				trust: {
					type: "external",
					reason: "unsigned",
				} as const,
				source: "user",
			},
			config,
			getResourceUrl: () => "blob:test",
			saveKey: {
				packageId: "package:settings",
				contentHash: "a".repeat(64),
			},
		};
		const runtimeHarness = createTestRendererRuntime({
			createResourceFx: () => createGameEngineResourceFx(createdGame),
		});
		runtimeHarnesses.push(runtimeHarness);
		game = (
			await runtimeHarness.rendererRuntime.runPromise(
				adoptTestGameEngineResourceFx(createdGame.arkpack.packageId),
			)
		).game;
	}
	const rootRoute = createRootRoute({
		component: Outlet,
	});
	const settingsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/settings",
		component: () =>
			createElement(
				RegistryContext.Provider,
				{
					value: registry,
				},
				createElement(AppearanceDataset),
				createElement(SettingsPage),
			),
	});
	const mainMenuRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/main-menu",
		component: () => createElement("p", null, "Main menu destination"),
	});
	const gameRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/game/$packageId",
		component: () => createElement("p", null, "Game destination"),
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			settingsRoute,
			mainMenuRoute,
			gameRoute,
		]),
		history: createMemoryHistory({
			initialEntries: [
				...initialEntries,
			],
		}),
	});
	await router.load();
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(RouterProvider, {
				router,
			}),
		);
	});
	return {
		container,
		deferred,
		game,
		root,
		router,
		write,
		writeCheatAvailability,
		writeWindowMode,
		checkEditorMcpPort,
		resolvePortCheck: (value: { readonly type: "available" }) => resolvePortCheck(value),
		writeEditorMcpPort,
		openDiagnostics,
		openUserData,
		registry,
	};
};

describe("Settings", () => {
	it("checks and saves the global MCP port on blur without an edit race", async () => {
		const { container, checkEditorMcpPort, resolvePortCheck, writeEditorMcpPort } =
			await renderSettings([
				"/settings",
			]);
		const input = container.querySelector<HTMLInputElement>(
			'[data-ui="SettingsEditorMcpPort"] input',
		);
		if (input === null) throw new Error("Expected Editor MCP port input.");
		await vi.waitFor(() => expect(input.value).toBe("32310"));

		await act(async () => {
			input.focus();
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
				input,
				"32311",
			);
			input.dispatchEvent(
				new Event("input", {
					bubbles: true,
				}),
			);
		});
		await act(async () => input.blur());
		await vi.waitFor(() => expect(checkEditorMcpPort).toHaveBeenCalledWith(32_311));
		expect(input.disabled).toBe(true);
		expect(container.textContent).toContain("Checking port…");

		await act(async () =>
			resolvePortCheck({
				type: "available",
			}),
		);
		await vi.waitFor(() => expect(writeEditorMcpPort).toHaveBeenCalledWith(32_311));
		expect(input.disabled).toBe(false);
		expect(container.textContent).toContain("Port is available and saved.");
	});

	it("opens the bounded diagnostic log directory", async () => {
		const { container, openDiagnostics } = await renderSettings([
			"/settings",
		]);

		await act(async () => buttonByText(container, "Open logs").click());
		await vi.waitFor(() => expect(openDiagnostics).toHaveBeenCalledOnce());
	});

	it("opens the Arkini user-data root from the final Settings action", async () => {
		const { container, openUserData } = await renderSettings([
			"/settings",
		]);

		await act(async () => buttonByText(container, "Open data folder").click());
		await vi.waitFor(() => expect(openUserData).toHaveBeenCalledOnce());
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

	it("toggles application-wide Cheat tools without an active Game", async () => {
		const { container, writeCheatAvailability, registry } = await renderSettings([
			"/settings",
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
		const radios = Array.from(
			options.querySelectorAll<HTMLInputElement>('input[name="window-mode"]'),
		);
		expect(radios.map((radio) => radio.value)).toEqual([
			"default",
			"bordered",
			"fullscreen",
		]);
		expect(radios[0]?.checked).toBe(true);
		const fullscreen = radios.find((radio) => radio.value === "fullscreen");
		if (fullscreen === undefined) throw new Error("Expected Fullscreen option.");

		await act(async () => fullscreen.click());

		await vi.waitFor(() => expect(writeWindowMode).toHaveBeenCalledWith("fullscreen"));
		await vi.waitFor(() => expect(registry.get(WindowModeAtom)).toBe("fullscreen"));
	});

	it("admits only one settings mutation before React publishes the pending render", async () => {
		const { container, deferred, write, writeCheatAvailability } = await renderSettings([
			"/settings",
		]);
		const light = Array.from(
			container.querySelectorAll<HTMLInputElement>('input[name="appearance-theme"]'),
		).find((input) => input.value === "light");
		const toggle = container.querySelector<HTMLInputElement>(
			'[data-ui="SettingsCheatAvailability"] input[type="checkbox"]',
		);
		if (light === undefined || toggle === null) throw new Error("Expected settings controls.");

		await act(async () => {
			light.click();
			toggle.click();
		});
		expect(write).toHaveBeenCalledOnce();
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
		const light = Array.from(
			container.querySelectorAll<HTMLInputElement>('input[name="appearance-theme"]'),
		).find((input) => input.value === "light");
		const back = buttonByText(container, "Back");
		if (light === undefined) throw new Error("Expected Light theme control.");

		await act(async () => {
			light.click();
			back.click();
		});

		expect(write).toHaveBeenCalledOnce();
		expect(router.state.location.pathname).toBe("/settings");

		await act(async () => deferred.resolve());
		await vi.waitFor(() => expect(back.disabled).toBe(false));
		await act(async () => back.click());
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/main-menu"));
	});

	it("releases the command authority after a failed write", async () => {
		const { container, deferred, writeCheatAvailability } = await renderSettings([
			"/settings",
		]);
		const light = Array.from(
			container.querySelectorAll<HTMLInputElement>('input[name="appearance-theme"]'),
		).find((input) => input.value === "light");
		if (light === undefined) throw new Error("Expected Light theme control.");

		await act(async () => light.click());
		await act(async () => deferred.reject(new Error("theme write rejected")));
		await vi.waitFor(() => expect(container.textContent).toContain("Theme update failed:"));

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
		const light = Array.from(
			container.querySelectorAll<HTMLInputElement>('input[name="appearance-theme"]'),
		).find((input) => input.value === "light");
		if (light === undefined) throw new Error("Expected Light theme control.");

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
		expect(router.state.location.pathname).toBe("/settings");
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
		const light = Array.from(
			container.querySelectorAll<HTMLInputElement>('input[name="appearance-theme"]'),
		).find((input) => input.value === "light");
		if (light === undefined) throw new Error("Expected Light theme control.");

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
				"/settings",
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
