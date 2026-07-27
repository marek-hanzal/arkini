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
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";
import { RendererLifecycleOwnerAtom } from "~/bridge/lifecycle/RendererLifecycleOwnerAtom";
import { createRendererLifecycleFx } from "~/bridge/lifecycle/createRendererLifecycleFx";
import { MainMenuPage } from "~/page/launcher/MainMenuPage";
import { LauncherStartupAtom } from "~/ui/launcher/LauncherStartupAtom";
import { LauncherStartupConfigAtom } from "~/ui/launcher/LauncherStartupConfigAtom";

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
					contentHash: "b".repeat(64),
					gameId: "other-game",
					title: "Other Game",
					configVersion: "1",
					compressedSize: 1,
					trust: {
						type: "official",
						keyId: "other-official",
					} as const,
					source: "built-in" as const,
				},
				{
					packageId: "arkini",
					contentHash: "a".repeat(64),
					gameId: "arkini",
					title: "Arkini",
					configVersion: "1",
					compressedSize: 1,
					trust: {
						type: "official",
						keyId: "test-official",
					} as const,
					source: "built-in" as const,
				},
			],
		};
		const catalog: ArkpackCatalog = {
			state: Effect.runSync(SubscriptionRef.make<ArkpackCatalog.State>(catalogState)),
			refreshFx: Effect.void,
			importFileFx: () => Effect.die("unused"),
			removeFx: () => Effect.die("unused"),
		};
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
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
		expect(container.textContent).toContain("Arkpacks");
		expect(container.textContent).toContain("Settings");
		expect(container.textContent).toContain("About");

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
