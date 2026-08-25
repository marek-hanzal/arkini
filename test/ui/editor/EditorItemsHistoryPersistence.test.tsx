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

import { EditorItemsPage } from "~/page/editor/EditorItemsPage";
import { EditorHistoryBackButton } from "~/ui/editor/EditorHistoryBackButton";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	project: undefined as unknown,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/ui/item/editor/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () => createElement("span"),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	state.project = {
		projectId: "project-test",
		title: "Project test",
		config: {
			items: {
				"producer:academy": {
					asset: {
						default: [
							"asset:academy",
						],
					},
					description: "Education producer",
					id: "producer:academy",
					title: "Academy",
					type: "producer",
					uid: "academy",
				},
			},
		},
	};
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const setSearch = async (input: HTMLInputElement, value: string) => {
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (setter === undefined) throw new Error("Missing native input value setter.");
	await act(async () => {
		setter.call(input, value);
		input.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};

const renderItemsRoute = async () => {
	const rootRoute = createRootRoute();
	const listRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId/editor/items/list",
		component: EditorItemsPage,
		validateSearch: (search) => ({
			itemType: search.itemType === "producer" ? "producer" : undefined,
			query: typeof search.query === "string" ? search.query : undefined,
		}),
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
			detailRoute,
		]),
		history: createMemoryHistory({
			initialEntries: [
				"/editor/project-test/editor/items/list",
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
		container,
		router,
	};
};

describe("Editor items history persistence", () => {
	it("restores route-owned query and type after opening an item", async () => {
		const { container, router } = await renderItemsRoute();
		const search = container.querySelector<HTMLInputElement>('[aria-label="Search items"]');
		if (search === null) throw new Error("Missing editor item search.");

		await setSearch(search, "Academy");
		await act(async () =>
			container
				.querySelector<HTMLElement>('[aria-label="Filter items by producer"]')
				?.click(),
		);
		await vi.waitFor(() =>
			expect(router.state.location.search).toEqual({
				itemType: "producer",
				query: "Academy",
			}),
		);

		await act(async () =>
			container.querySelector<HTMLElement>('[data-item-uid="academy"] a')?.click(),
		);
		await vi.waitFor(() =>
			expect(router.state.location.pathname).toContain("/academy/detail/"),
		);
		await act(async () => container.querySelector<HTMLAnchorElement>("a")?.click());
		await vi.waitFor(() => expect(router.state.location.pathname).toMatch(/\/items\/list$/));

		expect(
			container.querySelector<HTMLInputElement>('[aria-label="Search items"]')?.value,
		).toBe("Academy");
		expect(
			container
				.querySelector('[aria-label="Filter items by producer"]')
				?.getAttribute("aria-pressed"),
		).toBe("true");
	});
});
