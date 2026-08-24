// @vitest-environment jsdom

import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorBoardItemDetailLink } from "~/ui/board/editor/EditorBoardItemDetailLink";

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items: {
				water: {
					uid: "water",
				},
			},
		},
		projectId: "project-test",
	}),
}));

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

describe("EditorBoardItemDetailLink", () => {
	it("opens the canonical editor detail for the gameplay item identity", async () => {
		const rootRoute = createRootRoute({
			component: Outlet,
		});
		const boardRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/board",
			component: () => (
				<EditorBoardItemDetailLink
					disabled={false}
					itemId="water"
				>
					<span>Water identity</span>
				</EditorBoardItemDetailLink>
			),
		});
		const detailRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
			component: () => <p>Editor item detail</p>,
		});
		const router = createRouter({
			routeTree: rootRoute.addChildren([
				boardRoute,
				detailRoute,
			]),
			history: createMemoryHistory({
				initialEntries: [
					"/board",
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

		const link = container.querySelector<HTMLAnchorElement>(
			'[data-ui="EditorBoardItemDetailLink"]',
		);
		if (link === null) throw new Error("Missing editor Item Detail link.");
		expect(link.textContent).toContain("Water identity");
		expect(link.getAttribute("href")).toBe(
			"/editor/project-test/editor/items/water/detail/identity",
		);

		await act(async () => {
			link.click();
			await Promise.resolve();
		});

		expect(router.state.location.pathname).toBe(
			"/editor/project-test/editor/items/water/detail/identity",
		);
		expect(container.textContent).toContain("Editor item detail");
	});
});
