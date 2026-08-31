// @vitest-environment jsdom

import { RegistryContext } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	redirect,
	RouterProvider,
} from "@tanstack/react-router";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, vi } from "vitest";
import { AppearanceAtom } from "~/application-settings/atom/AppearanceAtom";
import { WindowModeAtom } from "~/window-mode/atom/WindowModeAtom";
import type { CompletionStatus } from "~electron/contract/cli/CompletionStatus";
import type { InstallationStatus } from "~electron/contract/cli/InstallationStatus";
import type { Game } from "~/installed-game/type/Game";
import type { GameEngine } from "~/playable-game/type/GameEngine";
import { createGameEngineResourceFx } from "~/playable-game/fx/createGameEngineResourceFx";
import { Route as SettingsRouteDefinition } from "~/@routes/_launcher/settings";
import { Route as CommonSettingsRouteDefinition } from "~/@routes/_launcher/settings/common";
import { Route as DevSettingsRouteDefinition } from "~/@routes/_launcher/settings/dev";
import { Route as GameSettingsRouteDefinition } from "~/@routes/_launcher/settings/game";
import { createTestGameSession } from "~test/support/createTestGameSession";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import {
	adoptTestGameEngineResourceFx,
	createTestRendererRuntime,
} from "~test/support/createTestRendererRuntime";
import { AppearanceDataset } from "~/application-settings/ui/AppearanceDataset";

const SettingsRoute = SettingsRouteDefinition.options.component;
const CommonSection = CommonSettingsRouteDefinition.options.component;
const DevSection = DevSettingsRouteDefinition.options.component;
const GameSection = GameSettingsRouteDefinition.options.component;
if (SettingsRoute === undefined) throw new Error("Settings route component is missing.");
if (CommonSection === undefined) throw new Error("Common Settings route component is missing.");
if (DevSection === undefined) throw new Error("Dev Settings route component is missing.");
if (GameSection === undefined) throw new Error("Game Settings route component is missing.");

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

export const roots: Array<ReturnType<typeof createRoot>> = [];
export const registries: Array<ReturnType<typeof AtomRegistry.make>> = [];
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
export const buttonByText = (container: ParentNode, text: string) => {
	const button = Array.from(container.querySelectorAll("button")).find(
		(candidate) => candidate.textContent === text,
	);
	if (!(button instanceof HTMLButtonElement)) throw new Error(`Expected ${text}.`);
	return button;
};

export const linkByText = (container: ParentNode, text: string) => {
	const link = Array.from(container.querySelectorAll("a")).find(
		(candidate) => candidate.textContent === text,
	);
	if (!(link instanceof HTMLAnchorElement)) throw new Error(`Expected ${text}.`);
	return link;
};

export const settingsOptionByValue = (
	container: ParentNode,
	ownerDataUi: string,
	value: string,
) => {
	const owner = Array.from(container.querySelectorAll<HTMLElement>("[data-ui]")).find(
		(candidate) => candidate.dataset.ui === ownerDataUi,
	);
	const option = Array.from(
		owner?.querySelectorAll<HTMLButtonElement>('[data-ui="SettingsSegmentedChoiceOption"]') ??
			[],
	).find((candidate) => candidate.dataset.uiValue === value);
	if (option === undefined) throw new Error(`Expected ${ownerDataUi} option ${value}.`);
	return option;
};

export const renderSettings = async (
	initialEntries: ReadonlyArray<string>,
	{
		activeGame = false,
		cliStatus = {
			type: "unavailable",
			commandPath: "/tmp/arkini-cli",
			message: "Available in packaged builds.",
		},
		completionStatus = {
			type: "unavailable",
			message: "Available in packaged builds.",
		},
	}: {
		readonly activeGame?: boolean;
		readonly cliStatus?: InstallationStatus;
		readonly completionStatus?: CompletionStatus;
	} = {},
) => {
	const deferred = createDeferred();
	const write = vi.fn(() => deferred.promise);
	const writeCheatAvailability = vi.fn(() => Promise.resolve());
	const openDiagnostics = vi.fn(() => Promise.resolve());
	const openUserData = vi.fn(() => Promise.resolve());
	const replaceCli = vi.fn(() =>
		Promise.resolve({
			type: "installed" as const,
			commandPath: cliStatus.commandPath,
		}),
	);
	const readCliStatus = vi.fn(() => Promise.resolve(cliStatus));
	const readCompletionStatus = vi.fn(() => Promise.resolve(completionStatus));
	const uninstallCompletion = vi.fn(() =>
		Promise.resolve({
			type: "not-installed" as const,
			completionPath:
				completionStatus.type === "unavailable"
					? "/tmp/_arkini-cli"
					: completionStatus.completionPath,
			shell:
				completionStatus.type === "unavailable" ? ("zsh" as const) : completionStatus.shell,
		}),
	);
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
			cli: {
				status: readCliStatus,
				install: vi.fn(),
				replace: replaceCli,
				uninstall: vi.fn(),
				completion: {
					status: readCompletionStatus,
					install: vi.fn(),
					replace: vi.fn(),
					uninstall: uninstallCompletion,
				},
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
				title: "Settings game",
				version: "1.0",
				arkini: "1.0",
				provenance: {
					type: "community",
				} as const,
				source: "user",
			},
			config,
			getResourceUrl: () => "blob:test",
			saveKey: {
				packageId: "package:settings",
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
				createElement(SettingsRoute),
			),
	});
	const settingsIndexRoute = createRoute({
		getParentRoute: () => settingsRoute,
		path: "/",
		beforeLoad: () => {
			throw redirect({
				to: "/settings/common",
				replace: true,
			});
		},
	});
	const settingsCommonRoute = createRoute({
		getParentRoute: () => settingsRoute,
		path: "/common",
		component: CommonSection,
	});
	const settingsGameRoute = createRoute({
		getParentRoute: () => settingsRoute,
		path: "/game",
		component: GameSection,
	});
	const settingsDevRoute = createRoute({
		getParentRoute: () => settingsRoute,
		path: "/dev",
		component: DevSection,
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
			settingsRoute.addChildren([
				settingsIndexRoute,
				settingsCommonRoute,
				settingsGameRoute,
				settingsDevRoute,
			]),
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
		openDiagnostics,
		openUserData,
		readCliStatus,
		readCompletionStatus,
		replaceCli,
		uninstallCompletion,
		registry,
	};
};
