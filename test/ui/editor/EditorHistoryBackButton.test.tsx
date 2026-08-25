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
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorHistoryBackButton } from "~/ui/editor/EditorHistoryBackButton";

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

const renderBack = async (initialEntries: ReadonlyArray<string>) => {
	const rootRoute = createRootRoute();
	const listRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId/editor/items/list",
		component: () => <p>Items</p>,
	});
	const flowRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId/flow",
		component: () => <p>Flow</p>,
	});
	const detailRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
		component: () => (
			<EditorHistoryBackButton
				to="/editor/$projectId/editor/items/list"
				params={{
					projectId: "project-test",
				}}
			>
				Back
			</EditorHistoryBackButton>
		),
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			listRoute,
			flowRoute,
			detailRoute,
		]),
		history: createMemoryHistory({
			initialEntries: [
				...initialEntries,
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
	return {
		button: container.querySelector<HTMLAnchorElement>("a"),
		router,
	};
};

describe("EditorHistoryBackButton", () => {
	it("returns through the exact history entry and uses the canonical fallback for a deep link", async () => {
		const fromFlow = await renderBack([
			"/editor/project-test/flow?direction=output&itemId=item%3Awater",
			"/editor/project-test/editor/items/water/detail/identity",
		]);
		await act(async () => fromFlow.button?.click());
		await vi.waitFor(() =>
			expect(fromFlow.router.state.location.pathname).toBe("/editor/project-test/flow"),
		);
		expect(fromFlow.router.state.location.search).toEqual({
			direction: "output",
			itemId: "item:water",
		});

		const deepLink = await renderBack([
			"/editor/project-test/editor/items/water/detail/identity",
		]);
		await act(async () => deepLink.button?.click());
		await vi.waitFor(() =>
			expect(deepLink.router.state.location.pathname).toBe(
				"/editor/project-test/editor/items/list",
			),
		);
		expect(deepLink.router.history.canGoBack()).toBe(false);
	});

	it("leaves modified clicks to normal link behavior", async () => {
		const fromFlow = await renderBack([
			"/editor/project-test/flow?direction=output&itemId=item%3Awater",
			"/editor/project-test/editor/items/water/detail/identity",
		]);
		await act(async () =>
			fromFlow.button?.dispatchEvent(
				new MouseEvent("click", {
					bubbles: true,
					cancelable: true,
					ctrlKey: true,
				}),
			),
		);
		expect(fromFlow.router.state.location.pathname).toBe(
			"/editor/project-test/editor/items/water/detail/identity",
		);
	});
});
