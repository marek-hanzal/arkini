// @vitest-environment jsdom

import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AboutPage } from "~/page/launcher/AboutPage";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const portraitState = vi.hoisted(() => ({
	urls: [] as string[],
}));

vi.mock("~/bridge/arkpack/useAboutPortraitAssets", () => ({
	useAboutPortraitAssets: () => portraitState.urls,
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	portraitState.urls = [];
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("About", () => {
	it("shares the launcher route and panel identities without a nested Hero snapshot", async () => {
		const rootRoute = createRootRoute({
			component: AboutPage,
		});
		const router = createRouter({
			routeTree: rootRoute,
			history: createMemoryHistory({
				initialEntries: [
					"/about",
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

		expect(
			container.querySelector<HTMLElement>('[data-ui="MainPageLayout"]')?.style
				.viewTransitionName,
		).toBe("");
		expect(
			container.querySelector<HTMLElement>('[data-ui="MainPagePanel"]')?.style
				.viewTransitionName,
		).toBe("arkini-panel-about");
		expect(
			container.querySelector<HTMLElement>('[data-ui="MainPagePanelContent"]')?.style
				.viewTransitionName,
		).toBe("");
		expect(
			container.querySelector<HTMLElement>('[data-ui="LauncherHero"]')?.style
				.viewTransitionName,
		).toBe("");
		expect(container.querySelector('[data-ui="About"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="AboutEasterEgg"]')).toBeNull();
		expect(container.textContent).toContain("ChatGPT-5.6");
		expect(container.textContent).toContain("ChatGPT-5.4");
		expect(container.textContent).toContain("ChatGPT-5.5");
		expect(container.textContent).toContain("blood-soaked legacy");
		expect(container.textContent).toContain("original v0");
		expect(container.textContent).toContain("Marek Hanzal");
		expect(container.textContent).toContain("chief mega-nag");
		expect(container.textContent).toContain("Šárka Hanušová");
	});

	it("enables the portrait easter egg only when package avatars resolve", async () => {
		portraitState.urls = [
			"avatar:only",
		];
		const rootRoute = createRootRoute({
			component: AboutPage,
		});
		const router = createRouter({
			routeTree: rootRoute,
			history: createMemoryHistory({
				initialEntries: [
					"/about",
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

		expect(container.querySelector('[data-ui="AboutEasterEgg"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="AboutJumpscare"]')).not.toBeNull();
		expect(container.querySelectorAll('[data-ui="FallingPortrait"]')).toHaveLength(8);
		expect(
			Array.from(container.querySelectorAll<HTMLImageElement>("img")).some((image) =>
				image.src.includes("avatar:only"),
			),
		).toBe(true);
	});
});
