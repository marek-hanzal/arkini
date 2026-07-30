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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorShell } from "~/ui/editor/EditorShell";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "editor-test",
		title: "Editor test",
	}),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: vi.fn(),
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const createGate = () => {
	let resolve: () => void = () => undefined;
	const promise = new Promise<void>((complete) => {
		resolve = complete;
	});
	return {
		promise,
		resolve,
	};
};

const readLink = (container: HTMLElement, label: string) => {
	const link = [
		...container.querySelectorAll<HTMLAnchorElement>("a"),
	].find((candidate) => candidate.textContent === label);
	if (link === undefined) throw new Error(`Missing ${label} editor tab.`);
	return link;
};

describe("EditorShell", () => {
	it("switches the active tab before the destination route finishes loading", async () => {
		const projectLoader = createGate();
		const rootRoute = createRootRoute();
		const editorRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/editor/$projectId",
			component: () => createElement(EditorShell, null, createElement(Outlet)),
		});
		const editorIndexRoute = createRoute({
			getParentRoute: () => editorRoute,
			path: "editor",
			component: () => createElement("p", null, "Editor destination"),
		});
		const projectRoute = createRoute({
			getParentRoute: () => editorRoute,
			path: "project",
			loader: () => projectLoader.promise,
			component: () => createElement("p", null, "Project destination"),
		});
		const buildRoute = createRoute({
			getParentRoute: () => editorRoute,
			path: "build",
			component: () => createElement("p", null, "Build destination"),
		});
		const boardRoute = createRoute({
			getParentRoute: () => editorRoute,
			path: "board",
			component: () => createElement("p", null, "Board destination"),
		});
		const mainMenuRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/main-menu",
			component: () => createElement("p", null, "Main menu"),
		});
		const router = createRouter({
			routeTree: rootRoute.addChildren([
				editorRoute.addChildren([
					editorIndexRoute,
					projectRoute,
					buildRoute,
					boardRoute,
				]),
				mainMenuRoute,
			]),
			history: createMemoryHistory({
				initialEntries: [
					"/editor/editor-test/build",
				],
			}),
			defaultPendingMs: 60_000,
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

		const projectLink = readLink(container, "Project");
		const buildLink = readLink(container, "Build");
		expect(buildLink.className).toContain("bg-accent");
		expect(projectLink.className).not.toContain("bg-accent");

		act(() => {
			projectLink.click();
		});

		expect(container.textContent).toContain("Build destination");
		expect(projectLink.className).toContain("bg-accent");
		expect(buildLink.className).not.toContain("bg-accent");

		await act(async () => {
			projectLoader.resolve();
			await projectLoader.promise;
		});
	});
});
