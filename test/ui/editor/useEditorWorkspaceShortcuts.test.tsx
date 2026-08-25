// @vitest-environment jsdom

import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useEditorWorkspaceShortcuts } from "~/ui/editor/useEditorWorkspaceShortcuts";

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const ShortcutSurface = ({ initiallyEnabled }: { readonly initiallyEnabled: boolean }) => {
	const [enabled, setEnabled] = useState(initiallyEnabled);
	useEditorWorkspaceShortcuts({
		enabled,
		projectId: "shortcut-test",
	});
	return (
		<>
			<input data-ui="ShortcutInput" />
			<button
				data-ui="DisableShortcuts"
				onClick={() => setEnabled(false)}
			/>
			<button
				data-ui="EnableShortcuts"
				onClick={() => setEnabled(true)}
			/>
			<Outlet />
		</>
	);
};

const createTestRouter = (enabled: boolean, initialEntry: string) => {
	const rootRoute = createRootRoute();
	const editorRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId",
		component: () => <ShortcutSurface initiallyEnabled={enabled} />,
	});
	const boardRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "board",
		component: () => <p>Board</p>,
	});
	const boardInventoryRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "board/inventory",
		component: () => <p>Inventory</p>,
	});
	const projectRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "project",
		component: () => <p>Project</p>,
	});
	return createRouter({
		routeTree: rootRoute.addChildren([
			editorRoute.addChildren([
				boardRoute,
				boardInventoryRoute,
				projectRoute,
			]),
		]),
		history: createMemoryHistory({
			initialEntries: [
				initialEntry,
			],
		}),
	});
};

const renderShortcuts = async (
	enabled = true,
	initialEntry = "/editor/shortcut-test/board",
) => {
	const router = createTestRouter(enabled, initialEntry);
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

const dispatchShortcut = async ({
	eventType = "keydown",
	key,
	shiftKey,
	target = document,
}: {
	readonly eventType?: "keydown" | "keyup";
	readonly key: string;
	readonly shiftKey: boolean;
	readonly target?: Document | HTMLElement;
}) => {
	const event = new KeyboardEvent(eventType, {
		bubbles: true,
		cancelable: true,
		code: `Key${key.toUpperCase()}`,
		ctrlKey: true,
		key,
		shiftKey,
	});
	await act(async () => {
		target.dispatchEvent(event);
		await Promise.resolve();
	});
	return event;
};

describe("useEditorWorkspaceShortcuts", () => {
	it("keeps Board Mod+P free and navigates to Project through Mod+Shift+P", async () => {
		const { router } = await renderShortcuts();

		const boardShortcut = await dispatchShortcut({
			key: "p",
			shiftKey: false,
		});
		expect(boardShortcut.defaultPrevented).toBe(false);
		expect(router.state.location.pathname).toBe("/editor/shortcut-test/board");

		const projectShortcut = await dispatchShortcut({
			key: "p",
			shiftKey: true,
		});
		expect(projectShortcut.defaultPrevented).toBe(true);
		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/editor/shortcut-test/project"),
		);
	});

	it("returns a nested workspace leaf to the same canonical target as its navbar action", async () => {
		const { router } = await renderShortcuts(
			true,
			"/editor/shortcut-test/board/inventory",
		);

		await dispatchShortcut({
			key: "b",
			shiftKey: true,
		});

		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/editor/shortcut-test/board"),
		);
	});

	it("does not claim workspace shortcuts while editing text", async () => {
		const { container, router } = await renderShortcuts();
		const input = container.querySelector<HTMLInputElement>('[data-ui="ShortcutInput"]');
		if (input === null) throw new Error("Expected shortcut test input.");

		const event = await dispatchShortcut({
			key: "p",
			shiftKey: true,
			target: input,
		});

		expect(event.defaultPrevented).toBe(false);
		expect(router.state.location.pathname).toBe("/editor/shortcut-test/board");
	});

	it("does not claim workspace shortcuts while the owning shell disables them", async () => {
		const { router } = await renderShortcuts(false);

		const event = await dispatchShortcut({
			key: "p",
			shiftKey: true,
		});

		expect(event.defaultPrevented).toBe(false);
		expect(router.state.location.pathname).toBe("/editor/shortcut-test/board");
	});

	it("works immediately after a disabled owner observed the previous key release", async () => {
		const { container, router } = await renderShortcuts();

		await dispatchShortcut({
			key: "p",
			shiftKey: true,
		});
		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/editor/shortcut-test/project"),
		);

		await act(async () =>
			container.querySelector<HTMLButtonElement>('[data-ui="DisableShortcuts"]')?.click(),
		);
		await dispatchShortcut({
			eventType: "keyup",
			key: "p",
			shiftKey: true,
		});
		await act(async () => {
			await router.navigate({
				to: "/editor/$projectId/board",
				params: {
					projectId: "shortcut-test",
				},
			});
			container.querySelector<HTMLButtonElement>('[data-ui="EnableShortcuts"]')?.click();
		});

		await dispatchShortcut({
			key: "p",
			shiftKey: true,
		});

		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/editor/shortcut-test/project"),
		);
	});
});
