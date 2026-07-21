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
import {
	Button,
	ButtonLink,
	DangerButton,
	DangerButtonLink,
	PrimaryButton,
	PrimaryButtonLink,
} from "~/ui/button/Button";

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

const elementByText = <T extends Element>(
	container: ParentNode,
	selector: string,
	text: string,
) => {
	const element = Array.from(container.querySelectorAll<T>(selector)).find(
		(candidate) => candidate.textContent === text,
	);
	if (element === undefined) throw new Error(`Expected ${text}.`);
	return element;
};

describe("Button primitives", () => {
	it("shares each visual role across native buttons and typed router links", async () => {
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
							to: "/about",
						},
						"Neutral link",
					),
					createElement(
						ButtonLink,
						{
							"aria-disabled": true,
							to: "/about",
						},
						"Disabled link",
					),
					createElement(
						Button,
						{
							disabled: true,
						},
						"Neutral button",
					),
					createElement(
						PrimaryButtonLink,
						{
							to: "/about",
						},
						"Primary link",
					),
					createElement(PrimaryButton, null, "Primary button"),
					createElement(
						PrimaryButton,
						{
							cursorIntent: "progress",
							disabled: true,
						},
						"Pending button",
					),
					createElement(
						DangerButtonLink,
						{
							to: "/about",
						},
						"Danger link",
					),
					createElement(DangerButton, null, "Danger button"),
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

		const neutralLink = elementByText<HTMLAnchorElement>(container, "a", "Neutral link");
		const disabledLink = elementByText<HTMLAnchorElement>(container, "a", "Disabled link");
		const neutralButton = elementByText<HTMLButtonElement>(
			container,
			"button",
			"Neutral button",
		);
		const primaryLink = elementByText<HTMLAnchorElement>(container, "a", "Primary link");
		const primaryButton = elementByText<HTMLButtonElement>(
			container,
			"button",
			"Primary button",
		);
		const pendingButton = elementByText<HTMLButtonElement>(
			container,
			"button",
			"Pending button",
		);
		const dangerLink = elementByText<HTMLAnchorElement>(container, "a", "Danger link");
		const dangerButton = elementByText<HTMLButtonElement>(container, "button", "Danger button");

		expect(neutralLink.className).toContain("bg-surface/75");
		expect(neutralButton.className).toContain("bg-surface/75");
		expect(primaryLink.className).toBe(primaryButton.className);
		expect(dangerLink.className).toBe(dangerButton.className);
		expect(neutralLink.className).not.toBe(primaryLink.className);
		expect(dangerLink.className).not.toBe(primaryLink.className);
		expect(neutralLink.className).toContain("cursor-pointer");
		expect(neutralButton.className).toContain("cursor-not-allowed");
		expect(disabledLink.className).toContain("cursor-not-allowed");
		expect(primaryButton.className).toContain("cursor-pointer");
		expect(pendingButton.className).toContain("cursor-progress");
		expect(primaryLink.className).toContain("bg-accent");
		expect(primaryLink.className).toContain("aria-disabled:hover:bg-accent");
		expect(pendingButton.className).toContain("disabled:hover:bg-accent");
		expect(dangerLink.className).toContain("bg-danger");
		expect(dangerLink.className).toContain("aria-disabled:hover:opacity-60");
		expect(neutralLink.getAttribute("href")).toBe("/about");
		expect(neutralButton.type).toBe("button");
		expect(neutralButton.disabled).toBe(true);

		await act(async () => disabledLink.click());
		expect(router.state.location.pathname).toBe("/");

		await act(async () => primaryLink.click());
		expect(router.state.location.pathname).toBe("/about");
	});
});
