// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { Effect, SubscriptionRef } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";
import { RendererLifecycleOwnerAtom } from "~/bridge/lifecycle/RendererLifecycleOwnerAtom";
import { createRendererLifecycleFx } from "~/bridge/lifecycle/createRendererLifecycleFx";
import { MainMenuPage } from "~/page/launcher/MainMenuPage";
import { LauncherStartupAtom } from "~/ui/launcher/LauncherStartupAtom";
import { LauncherStartupConfigAtom } from "~/ui/launcher/LauncherStartupConfigAtom";
import { EditorServiceStatusAtom } from "~/bridge/editor/EditorServiceStatusAtom";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
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
		const catalogState = {
			type: "ready" as const,
			arkpacks: [
				{
					packageId: "competing-official",
					hash: "b".repeat(64),
					gameId: "other-game",
					title: "Other Game",
					game: "1",
					trust: {
						type: "official",
						keyId: "other-official",
					} as const,
					source: "built-in" as const,
				},
				{
					packageId: "arkini",
					hash: "a".repeat(64),
					gameId: "arkini",
					title: "Arkini",
					game: "1",
					trust: {
						type: "official",
						keyId: "test-official",
					} as const,
					source: "built-in" as const,
				},
			],
		};
		const catalog: ArkpackCatalog = {
			awaitIdleFx: Effect.void,
			state: Effect.runSync(SubscriptionRef.make<ArkpackCatalog.State>(catalogState)),
			refreshFx: Effect.void,
			importFileFx: () => Effect.die("unused"),
			installFx: () => Effect.die("unused"),
			removeFx: () => Effect.die("unused"),
		};
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(EditorServiceStatusAtom, {
			type: "ready",
		});
		registry.set(ArkpackCatalogOwnerAtom, catalog);
		registry.set(
			RendererLifecycleOwnerAtom,
			Effect.runSync(
				createRendererLifecycleFx({
					forceClose: () => undefined,
					requestClose,
					waitUntilVisible: () => Promise.resolve(performance.now()),
				}),
			),
		);
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "/hero.png",
			bootstrapFx: Effect.succeed({
				appearance: {
					theme: "dark" as const,
					accent: "rose" as const,
				},
				builtInPackageId: "arkini",
				cheatsAvailable: false,
				windowMode: "bordered" as const,
			}),
		});
		registry.mount(LauncherStartupAtom);
		await vi.waitFor(() => {
			const startup = registry.get(LauncherStartupAtom);
			expect(AsyncResult.isSuccess(startup) && !startup.waiting).toBe(true);
		});
		const App = () =>
			createElement(
				RegistryContext.Provider,
				{
					value: registry,
				},
				createElement(MainMenuPage),
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
		expect(play?.getAttribute("href")).toContain("/action/load-game/arkini");
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
		const panel = container.querySelector<HTMLElement>('[data-ui="MainPagePanel"]');
		expect(menu?.className).not.toContain("ak-list");
		expect(menu?.className).toContain("gap-4");
		expect(panel?.className).toContain("border-0");
		expect(panel?.className).toContain("bg-transparent");
		expect(panel?.className).toContain("shadow-none");
		expect(play?.className).toContain("bg-accent");
		expect(play?.className).toContain("text-accent-contrast");
		expect(
			Array.from(menu?.querySelectorAll("a, button") ?? []).every(
				(control) => !control.className.includes("ak-list-row"),
			),
		).toBe(true);
		const editor = Array.from(container.querySelectorAll("a")).find(
			(link) => link.textContent === "Editor",
		);
		expect(editor?.getAttribute("href")).toBe("/editor/welcome");
		await act(async () => {
			registry.set(EditorServiceStatusAtom, {
				type: "unavailable",
				message: "SQLite unavailable.",
			});
		});
		await vi.waitFor(() => expect(container.textContent).toContain("Editor unavailable"));
		expect(
			Array.from(container.querySelectorAll("a")).some((link) =>
				link.getAttribute("href")?.includes("/editor"),
			),
		).toBe(false);
		const unavailableEditor = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Editor unavailable",
		);
		expect(unavailableEditor).toBeInstanceOf(HTMLButtonElement);
		expect((unavailableEditor as HTMLButtonElement).disabled).toBe(true);
		expect(container.textContent).toContain("SQLite unavailable.");
		expect(
			Array.from(container.querySelectorAll("a")).some((link) => link.textContent === "Play"),
		).toBe(true);
		expect(container.textContent).toContain("Arkpacks");
		expect(container.textContent).toContain("Settings");
		expect(container.textContent).toContain("About");
		expect(
			container.querySelector<HTMLElement>('[data-ui="ArkiniAppVersion"]')?.textContent,
		).toBe(`v${ArkiniAppVersion}`);

		const exit = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Exit",
		);
		if (!(exit instanceof HTMLButtonElement)) throw new Error("Expected Exit button.");
		await act(async () => {
			exit.click();
			exit.click();
			await Promise.resolve();
		});
		expect(requestClose).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(exit.disabled).toBe(true));
		await act(async () => {
			resolveClose?.();
			await Promise.resolve();
		});
	});
});
