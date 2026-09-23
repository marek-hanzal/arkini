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

import { ButtonLink, PrimaryButtonLink } from "~/ui/ui/Button";

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

describe("Button primitives", () => {
	it("blocks disabled link navigation while allowing an enabled link", async () => {
		const rootRoute = createRootRoute();
		const indexRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/",
			component: () =>
				createElement(
					"main",
					null,
					createElement(
						ButtonLink,
						{
							disabled: true,
							to: "/about",
						},
						"Disabled link",
					),
					createElement(
						PrimaryButtonLink,
						{
							to: "/about",
						},
						"Enabled link",
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

		const disabledLink = container.querySelector<HTMLAnchorElement>(
			'a[data-ui-disabled="true"]',
		);
		const enabledLink = container.querySelector<HTMLAnchorElement>(
			'a[data-ui-disabled="false"]',
		);

		await act(async () => disabledLink!.click());
		expect(router.state.location.pathname).toBe("/");

		await act(async () => enabledLink!.click());
		expect(router.state.location.pathname).toBe("/about");
	});
});
