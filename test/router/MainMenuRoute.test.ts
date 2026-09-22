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
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import type { SerapackCatalog } from "~/serapack-catalog/service/SerapackCatalog";
import { SerapackCatalogOwnerAtom } from "~/serapack-catalog/atom/SerapackCatalogOwnerAtom";
import { RendererLifecycleOwnerAtom } from "~/application-runtime/atom/RendererLifecycleOwnerAtom";
import { createRendererLifecycleFx } from "~/application-runtime/fx/createRendererLifecycleFx";
import { Route as MainMenuRouteDefinition } from "~/@routes/_launcher/main-menu";
import { LauncherStartupAtom } from "~/launcher/atom/LauncherStartupAtom";
import { LauncherStartupConfigAtom } from "~/launcher/atom/LauncherStartupConfigAtom";
import { EditorServiceStatusAtom } from "~/project-authoring/atom/EditorServiceStatusAtom";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];
const MainMenuRoute = MainMenuRouteDefinition.options.component;
if (MainMenuRoute === undefined) throw new Error("Main menu route component is missing.");

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("MainMenu", () => {
	it.each([
		false,
		true,
	])("uses the effective default package and guards new game (saved=%s)", async (saved) => {
		let resolveExportFn: ((saved: boolean) => void) | undefined;
		const exportFn = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					resolveExportFn = resolve;
				}),
		);
		Object.defineProperty(window, "serakki", {
			configurable: true,
			value: {
				diagnostics: {
					exportFn,
				},
			},
		});
		vi.spyOn(MainMenuRouteDefinition, "useLoaderData").mockReturnValue(
			saved
				? [
						{
							slot: "current",
							savedAt: 1,
						},
					]
				: [],
		);
		let resolveClose: (() => void) | undefined;
		const requestClose = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveClose = resolve;
				}),
		);
		const catalogState = {
			type: "ready" as const,
			serapacks: [
				{
					packageId: "competing-official",
					contentHash: "b".repeat(64),
					title: "Other Game",
					version: "1.0",
					serakki: "1",
					provenance: {
						type: "official",
					} as const,
					source: "bundled" as const,
				},
				{
					packageId: "serakki",
					contentHash: "a".repeat(64),
					title: "Serakki",
					version: "1.0",
					serakki: "1",
					provenance: {
						type: "official",
					} as const,
					source: "bundled" as const,
				},
			],
		};
		const catalogStateRef = Effect.runSync(
			SubscriptionRef.make<SerapackCatalog.State>(catalogState),
		);
		const catalog: SerapackCatalog = {
			awaitIdleFx: Effect.void,
			state: catalogStateRef,
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
		registry.set(SerapackCatalogOwnerAtom, catalog);
		registry.set(
			RendererLifecycleOwnerAtom,
			Effect.runSync(
				createRendererLifecycleFx({
					forceCloseFn: () => undefined,
					requestCloseFn: requestClose,
					waitUntilVisibleFn: () => Promise.resolve(performance.now()),
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
				defaultPackageId: "serakki",
				cheatsAvailable: false,
				sound: {
					master: 100,
					music: 100,
					sfx: 100,
				},
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
				createElement(MainMenuRoute),
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
			(link) => link.textContent?.trim() === (saved ? "Continue" : "New Game"),
		);
		expect(play?.getAttribute("href")).toContain("/action/load-game/serakki");
		if (saved) {
			const newGame = Array.from(container.querySelectorAll("button")).find(
				(button) => button.textContent === "New Game",
			)!;
			await act(async () => newGame.click());
			const confirmed = container.querySelector<HTMLAnchorElement>(
				'[data-ui="MainMenuNewGameConfirmation"] a',
			);
			expect(confirmed?.getAttribute("href")).toContain("newGame=true");
			await act(async () =>
				container
					.querySelector<HTMLButtonElement>(
						'[data-ui="MainMenuNewGameConfirmation"] button',
					)!
					.click(),
			);
			expect(container.querySelector('[data-ui="MainMenuNewGameConfirmation"] a')).toBeNull();
		}
		await act(async () => {
			await Effect.runPromise(
				SubscriptionRef.set(catalogStateRef, {
					type: "ready",
					serapacks: [
						{
							...catalogState.serapacks[1]!,
							provenance: {
								type: "community",
							},
						},
					],
				}),
			);
		});
		await vi.waitFor(() =>
			expect(container.textContent).toContain(saved ? "Continue" : "New Game"),
		);
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
			Array.from(container.querySelectorAll("a")).some(
				(link) => link.textContent?.trim() === (saved ? "Continue" : "New Game"),
			),
		).toBe(true);
		expect(container.textContent).toContain("Serapacks");
		expect(container.textContent).toContain("Settings");
		expect(container.textContent).toContain("About");
		expect(
			container.querySelector<HTMLElement>('[data-ui="ExportDiagnostics"]')?.textContent,
		).toContain("Export diagnostics");
		expect(
			container.querySelector<HTMLElement>('[data-ui="SerakkiAppVersion"]')?.textContent,
		).toBe(`v${SerakkiAppVersion}`);
		const exportDiagnostics = container.querySelector<HTMLButtonElement>(
			'[data-ui="ExportDiagnostics"]',
		);
		if (exportDiagnostics === null) throw new Error("Expected diagnostics export button.");
		await act(async () => exportDiagnostics.click());
		await vi.waitFor(() => {
			expect(exportFn).toHaveBeenCalledOnce();
			expect(exportDiagnostics.disabled).toBe(true);
			expect(exportDiagnostics.querySelector(".animate-spin")).not.toBeNull();
		});
		await act(async () => {
			resolveExportFn?.(false);
			await Promise.resolve();
		});
		await vi.waitFor(() => expect(exportDiagnostics.disabled).toBe(false));

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
