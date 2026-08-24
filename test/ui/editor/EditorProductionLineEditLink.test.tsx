// @vitest-environment jsdom

import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorLine } from "~/bridge/item/editor/EditorItemModel";
import { EditorBoardProductionLineLink } from "~/ui/board/editor/EditorBoardProductionLineLink";
import { EditorProductionLineDetail } from "~/ui/item/editor/EditorProductionLineDetail";

vi.mock("~/ui/item/editor/EditorProductionLineInputs", () => ({
	EditorProductionLineInputs: () => <span>Inputs</span>,
}));

vi.mock("~/ui/item/editor/EditorProductionLineOutputs", () => ({
	EditorProductionLineOutputs: () => <span>Outputs</span>,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items: {
				workshop: {
					id: "workshop",
					lines: [
						{
							id: "line:workshop:water",
						},
					],
					type: "producer",
					uid: "workshop",
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

const renderRoute = async (content: ReactNode, initialEntry: string) => {
	const rootRoute = createRootRoute({
		component: Outlet,
	});
	const sourceRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: initialEntry,
		component: () => content,
	});
	const productionRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId/editor/items/$itemUid/form/$sectionId",
		component: () => <p>Editor production form</p>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			sourceRoute,
			productionRoute,
		]),
		history: createMemoryHistory({
			initialEntries: [
				initialEntry,
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

const expectedHref =
	"/editor/project-test/editor/items/workshop/form/production?lineId=line%3Aworkshop%3Awater";

describe("EditorProductionLineEditLink", () => {
	it("opens the exact authored line from the gameplay summary", async () => {
		const { container, router } = await renderRoute(
			<EditorBoardProductionLineLink
				disabled={false}
				itemId="workshop"
				lineId="line:workshop:water"
			>
				<span>Water production</span>
			</EditorBoardProductionLineLink>,
			"/board",
		);
		const link = container.querySelector<HTMLAnchorElement>(
			'[data-ui="EditorBoardProductionLineLink"]',
		);
		expect(link?.getAttribute("href")).toBe(expectedHref);

		await act(async () => {
			link?.click();
			await Promise.resolve();
		});
		expect(router.state.location.pathname).toBe(
			"/editor/project-test/editor/items/workshop/form/production",
		);
		expect(router.state.location.search).toEqual({
			lineId: "line:workshop:water",
		});
	});

	it("links the read-only production detail to its exact authored line", async () => {
		const line: EditorLine = {
			default: true,
			description: "Create water.",
			enable: true,
			id: "line:workshop:water",
			input: [
				{
					type: "simple",
				},
			],
			rules: [],
			runtimeMs: 1_000,
			show: true,
			title: "Water",
		};
		const { container } = await renderRoute(
			<EditorProductionLineDetail
				itemUid="workshop"
				line={line}
			/>,
			"/detail",
		);
		const link = container.querySelector<HTMLAnchorElement>(
			'[data-ui="EditorProductionLineDetailEditLink"]',
		);
		expect(link?.textContent).toContain("Water");
		expect(link?.getAttribute("href")).toBe(expectedHref);
	});
});
