// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { ArkpackCatalogContext } from "~/bridge/arkpack/ArkpackCatalogContext";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { LauncherStartupContext } from "~/ui/launcher/LauncherStartupContext";
import { MainMenuPage } from "~/page/launcher/MainMenuPage";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("MainMenu", () => {
	it("plays the authoritative built-in package and requests native exit once", async () => {
		let resolveClose: (() => void) | undefined;
		const requestClose = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveClose = resolve;
				}),
		);
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				lifecycle: {
					requestClose,
				},
			},
		});
		const catalogState = {
			type: "ready" as const,
			arkpacks: [
				{
					packageId: "canonical-built-in",
					contentHash: "a".repeat(64),
					gameId: "arkini",
					title: "Arkini",
					configVersion: "1",
					compressedSize: 1,
					source: "built-in" as const,
				},
			],
		};
		const catalog: ArkpackCatalog = {
			getSnapshot: () => catalogState,
			refreshFx: Effect.void,
			importFileFx: () => Effect.die("unused"),
			removeFx: () => Effect.die("unused"),
			subscribe: () => () => undefined,
		};
		const startupState: LauncherStartup.State = {
			type: "ready",
			appearance: {
				theme: "dark",
				accent: "rose",
			},
			builtInPackageId: "canonical-built-in",
			cheatsAvailable: false,
			heroReady: true,
			splashCompleted: true,
		};
		const startup: LauncherStartup = {
			getSnapshot: () => startupState,
			startFx: Effect.void,
			retryFx: Effect.void,
			completeSplashFx: Effect.void,
			subscribe: () => () => undefined,
		};
		const App = () =>
			createElement(
				QueryClientProvider,
				{
					client: new QueryClient(),
				},
				createElement(
					ArkpackCatalogContext.Provider,
					{
						value: catalog,
					},
					createElement(
						LauncherStartupContext.Provider,
						{
							value: startup,
						},
						createElement(MainMenuPage),
					),
				),
			);
		const rootRoute = createRootRoute({
			component: App,
		});
		const router = createRouter({
			routeTree: rootRoute,
			history: createMemoryHistory({
				initialEntries: [
					"/main-menu",
				],
			}),
		});
		await router.load();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () =>
			root.render(
				createElement(RouterProvider, {
					router,
				}),
			),
		);

		const play = Array.from(container.querySelectorAll("a")).find(
			(link) => link.textContent === "Play",
		);
		expect(play?.getAttribute("href")).toContain("/action/load-game/canonical-built-in");
		expect(
			container.querySelector<HTMLElement>('[data-ui="MainPageLayout"]')?.style
				.viewTransitionName,
		).toBe("");
		expect(
			container.querySelector<HTMLElement>('[data-ui="MainPagePanel"]')?.style
				.viewTransitionName,
		).toBe("arkini-panel-main-menu");
		expect(
			container.querySelector<HTMLElement>('[data-ui="MainPagePanelContent"]')?.style
				.viewTransitionName,
		).toBe("");
		expect(
			container.querySelector<HTMLElement>('[data-ui="LauncherHero"]')?.style
				.viewTransitionName,
		).toBe("");
		expect(container.querySelector('[data-ui="LauncherHeroShadow"]')).not.toBeNull();
		const menu = container.querySelector<HTMLElement>('[data-ui="MainMenu"]');
		expect(menu?.className).not.toContain("ak-list");
		expect(play?.className).toContain("bg-accent");
		expect(play?.className).toContain("text-accent-contrast");
		expect(
			Array.from(menu?.querySelectorAll("a, button") ?? []).every(
				(control) => !control.className.includes("ak-list-row"),
			),
		).toBe(true);
		expect(container.textContent).toContain("Arkpacks");
		expect(container.textContent).toContain("Settings");
		expect(container.textContent).toContain("About");

		const exit = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Exit",
		);
		if (!(exit instanceof HTMLButtonElement)) throw new Error("Expected Exit button.");
		await act(async () => {
			exit.click();
			await vi.waitFor(() => expect(exit.disabled).toBe(true));
		});
		await act(async () => exit.click());
		expect(requestClose).toHaveBeenCalledOnce();
		await act(async () => {
			resolveClose?.();
			await Promise.resolve();
		});
	});
});
