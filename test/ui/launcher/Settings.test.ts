// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Effect } from "effect";
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
import { createCheatAvailability } from "~/bridge/cheat/createCheatAvailability";
import type { Game } from "~/bridge/game/Game";
import type { GameEngine } from "~/bridge/game/GameEngine";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { SettingsPage } from "~/page/settings/SettingsPage";
import { createTestGameSession } from "~test/bridge/game/createTestGameSession";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { AppearanceProvider } from "~/ui/appearance/AppearanceProvider";
import { CheatAvailabilityProvider } from "~/ui/cheat-availability/CheatAvailabilityProvider";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const sessions: Game[] = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const session of sessions.splice(0)) {
		await Effect.runPromise(session.disposeWithoutSaveFx);
	}
	vi.restoreAllMocks();
	document.body.replaceChildren();
	Reflect.deleteProperty(window, "arkini");
});

const createDeferred = () => {
	let resolve: () => void = () => undefined;
	const promise = new Promise<void>((complete) => {
		resolve = complete;
	});
	return {
		promise,
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
	const cheatAvailability = createCheatAvailability();
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			appearance: {
				write,
			},
			cheats: {
				writeAvailable: writeCheatAvailability,
			},
		},
	});
	const queryClient = new QueryClient({
		defaultOptions: {
			mutations: {
				retry: false,
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
		game = {
			...session,
			arkpack: {
				packageId: "package:settings",
				contentHash: "content:settings",
				gameId: "game:settings",
				title: "Settings game",
				configVersion: "1.0",
				compressedSize: 0,
				source: "imported",
			},
			config,
			getResourceUrl: () => "blob:test",
			readOrThrow: () => {
				throw new Error("Not used by this test.");
			},
			saveKey: {
				packageId: "package:settings",
				contentHash: "a".repeat(64),
			},
		};
		sessions.push(game);
		queryClient.setQueryData(gameEngineQueryKey, {
			game,
			assertUsable: () => undefined,
			markCriticalFailure: () => {
				throw new Error("Not used by this test.");
			},
			withLifecycleLockFx: (effect) => effect,
		} as GameEngineResource);
	}
	const rootRoute = createRootRoute({
		component: Outlet,
	});
	const settingsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/settings",
		component: () =>
			createElement(
				QueryClientProvider,
				{
					client: queryClient,
				},
				createElement(
					AppearanceProvider,
					{
						initialTheme: "dark",
					},
					createElement(
						CheatAvailabilityProvider,
						{
							availability: cheatAvailability,
						},
						createElement(SettingsPage),
					),
				),
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
		router,
		write,
		writeCheatAvailability,
		cheatAvailability,
	};
};

describe("Settings", () => {
	it("changes and persists the authoritative theme, then returns through history with Escape", async () => {
		const { container, deferred, router, write } = await renderSettings([
			"/main-menu",
			"/settings",
		]);

		const page = container.querySelector<HTMLElement>('[data-ui="MainPageLayout"]');
		expect(page?.style.viewTransitionName).toBe("");
		const panel = container.querySelector<HTMLElement>('[data-ui="MainPagePanel"]');
		const panelContent = container.querySelector<HTMLElement>(
			'[data-ui="MainPagePanelContent"]',
		);
		expect(panel).not.toBeNull();
		expect(panel?.style.viewTransitionName).toBe("arkini-panel-settings");
		expect(panelContent?.style.viewTransitionName).toBe("");
		expect(
			container.querySelector<HTMLElement>('[data-ui="LauncherHero"]')?.style
				.viewTransitionName,
		).toBe("");
		const radios = Array.from(container.querySelectorAll('input[name="appearance-theme"]'));
		expect(radios).toHaveLength(3);
		const themeOptions = container.querySelector<HTMLElement>(
			'[data-ui="SettingsThemeOptions"]',
		);
		expect(themeOptions?.className).not.toContain("ak-list");
		const themeRows = Array.from(themeOptions?.querySelectorAll("label") ?? []);
		expect(themeRows).toHaveLength(3);
		expect(themeRows.every((row) => !row.className.includes("ak-list-row"))).toBe(true);
		expect(themeRows.find((row) => row.dataset.selected === "true")?.className).toContain(
			"bg-accent",
		);
		expect(themeRows.find((row) => row.dataset.selected === "true")?.className).toContain(
			"text-accent-contrast",
		);
		const light = radios.find(
			(input) => input instanceof HTMLInputElement && input.value === "light",
		);
		if (!(light instanceof HTMLInputElement)) throw new Error("Expected Light theme radio.");
		expect(document.documentElement.dataset.theme).toBe("dark");
		await act(async () => light.click());
		expect(document.documentElement.dataset.theme).toBe("light");
		expect(write).toHaveBeenCalledOnce();
		expect(write).toHaveBeenCalledWith("light");
		expect(container.textContent).toContain("Saving theme…");
		const fieldset = container.querySelector("fieldset");
		expect(fieldset).toBeInstanceOf(HTMLFieldSetElement);
		expect((fieldset as HTMLFieldSetElement).disabled).toBe(true);
		expect(
			Array.from(themeOptions?.querySelectorAll("label") ?? []).every(
				(row) => row.dataset.pending === "true" && row.className.includes("opacity-60"),
			),
		).toBe(true);

		await act(async () => deferred.resolve());
		await act(async () => {
			await vi.waitFor(() => expect(container.textContent).toContain("Theme saved."));
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

	it("toggles application-wide Cheat tools without an active Game", async () => {
		const { container, writeCheatAvailability, cheatAvailability } = await renderSettings([
			"/settings",
		]);
		const toggle = container.querySelector<HTMLInputElement>(
			'[data-ui="SettingsCheatAvailability"] input[type="checkbox"]',
		);
		if (toggle === null) throw new Error("Expected Cheat tools control.");
		await act(async () => toggle.click());
		await vi.waitFor(() => expect(writeCheatAvailability).toHaveBeenCalledWith(true));
		await vi.waitFor(() => expect(cheatAvailability.getSnapshot()).toBe(true));
	});

	it("toggles application-wide Cheat tools without mutating the cached Game", async () => {
		const { container, game, writeCheatAvailability, cheatAvailability } = await renderSettings(
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
		await vi.waitFor(() => expect(cheatAvailability.getSnapshot()).toBe(true));
		expect(game.getSnapshot().cheats).toEqual({
			enabled: false,
			everEnabled: false,
			instantGameplay: false,
		});
	});
});
