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
import { Route as AboutRouteDefinition } from "~/@routes/_launcher/about";

const AboutScene = AboutRouteDefinition.options.component;
if (AboutScene === undefined) throw new Error("About route component is missing.");

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const portraitState = vi.hoisted(() => ({
	urls: [] as string[],
}));

vi.mock("~/ui/launcher/about/AboutPortraitAssetsAtom", async () => {
	const [Atom, AsyncResult] = await Promise.all([
		import("effect/unstable/reactivity/Atom"),
		import("effect/unstable/reactivity/AsyncResult"),
	]);
	return {
		AboutPortraitAssetsAtom: Atom.make(() => AsyncResult.success(portraitState.urls)),
	};
});

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
	it("enables the portrait easter egg only when package avatars resolve", async () => {
		portraitState.urls = [
			"avatar:only",
		];
		const rootRoute = createRootRoute({
			component: AboutScene,
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
		expect(
			Array.from(container.querySelectorAll<HTMLImageElement>("img")).some((image) =>
				image.src.includes("avatar:only"),
			),
		).toBe(true);
	});

	it("deduplicates same-tick exits and releases the action after rejected navigation", async () => {
		const rootRoute = createRootRoute();
		const aboutRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/about",
			component: AboutScene,
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
