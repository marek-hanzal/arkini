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
import { afterEach, describe, expect, it } from "vitest";
import { PrimaryButton, PrimaryButtonLink } from "~/ui/button/PrimaryButton";

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
	document.body.replaceChildren();
});

describe("PrimaryButton", () => {
	it("shares one visual primitive across native buttons and typed router links", async () => {
		const rootRoute = createRootRoute();
		const indexRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/",
			component: () =>
				createElement(
					"main",
					null,
					createElement(
						PrimaryButtonLink,
						{
							to: "/about",
						},
						"About",
					),
					createElement(
						PrimaryButton,
						{
							disabled: true,
						},
						"Save",
					),
				),
		});
		const aboutRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/about",
			component: () => createElement("p", null, "About destination"),
		});
		const router = createRouter({
			routeTree: rootRoute.addChildren([
				indexRoute,
				aboutRoute,
			]),
			history: createMemoryHistory({
				initialEntries: [
					"/",
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

		const link = container.querySelector("a");
		const button = container.querySelector("button");
		expect(link).toBeInstanceOf(HTMLAnchorElement);
		expect(button).toBeInstanceOf(HTMLButtonElement);
		if (!(link instanceof HTMLAnchorElement) || !(button instanceof HTMLButtonElement)) {
			throw new Error("Expected primary link and button elements.");
		}
		expect(link.className).toBe(button.className);
		expect(link.getAttribute("href")).toBe("/about");
		expect(button.type).toBe("button");
		expect(button.disabled).toBe(true);

		await act(async () => link.click());
		expect(router.state.location.pathname).toBe("/about");
	});
});
