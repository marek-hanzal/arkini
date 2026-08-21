// @vitest-environment jsdom

import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
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

		expect(container.querySelector('[data-ui="About"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="AboutEasterEgg"]')).toBeNull();
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
	it("mounts all seven package avatars into the shared falling and corner portrait pool", async () => {
		portraitState.urls = [
			"avatar:one",
			"avatar:two",
			"avatar:three",
			"avatar:four",
			"avatar:five",
			"avatar:six",
			"avatar:seven",
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

		expect(container.querySelectorAll('[data-ui="FallingPortrait"]')).toHaveLength(8);
		expect(container.querySelectorAll('[data-ui="CornerPortraitPeekPortrait"]')).toHaveLength(
			28,
		);
		const imageSources = Array.from(container.querySelectorAll<HTMLImageElement>("img")).map(
			(image) => image.src,
		);
		for (const avatar of portraitState.urls) {
			expect(imageSources.some((source) => source.includes(avatar))).toBe(true);
		}
	});

	it("deduplicates same-tick exits and releases the action after rejected navigation", async () => {
		const rootRoute = createRootRoute();
		const aboutRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/about",
			component: AboutPage,
		});
		const mainMenuRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/main-menu",
			component: () => createElement("p", null, "Main menu destination"),
		});
		const router = createRouter({
			routeTree: rootRoute.addChildren([
				aboutRoute,
				mainMenuRoute,
			]),
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
		const navigate = vi
			.spyOn(router, "navigate")
			.mockRejectedValueOnce(new Error("about navigation rejected"));
		const button = container.querySelector<HTMLButtonElement>("button");
		if (button === null) throw new Error("Missing About return action.");

		await act(async () => {
			button.click();
			button.click();
			await Promise.resolve();
		});

		expect(navigate).toHaveBeenCalledTimes(1);
		expect(container.textContent).toContain("Navigation failed: about navigation rejected");
		expect(button.disabled).toBe(false);

		await act(async () => button.click());
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/main-menu"));
		expect(navigate).toHaveBeenCalledTimes(2);
	});
});
