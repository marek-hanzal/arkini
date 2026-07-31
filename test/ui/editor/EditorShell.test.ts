// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import {
	act,
	createElement,
	useCallback,
	useMemo,
	useState,
} from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	type EditorFormActions,
	useRegisterEditorFormActions,
} from "~/ui/editor/EditorFormActions";
import { EditorShell } from "~/ui/editor/EditorShell";

const session = vi.hoisted(() => ({
	close: vi.fn<() => Promise<void>>(),
	release: vi.fn(),
	resume: vi.fn(),
}));

vi.mock("~/bridge/editor/EditorProjectSession", () => ({
	closeEditorProjectSessionFx: () =>
		Effect.tryPromise({
			try: () => session.close(),
			catch: (error) => error,
		}),
	releaseEditorProjectSession: session.release,
	resumeEditorProjectSession: session.resume,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "editor-test",
		title: "Editor test",
	}),
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];
let closeFailedListener: ((error: unknown) => void) | undefined;

beforeEach(() => {
	session.close.mockReset().mockResolvedValue(undefined);
	session.release.mockReset();
	session.resume.mockReset();
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: vi.fn(),
	});
	closeFailedListener = undefined;
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			lifecycle: {
				onCloseFailed: (listener: (error: unknown) => void) => {
					closeFailedListener = listener;
					return () => {
						closeFailedListener = undefined;
					};
				},
			},
		},
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
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

const formCalls = {
	discard: vi.fn(),
	save: vi.fn<() => Promise<void>>(),
};

const DirtyItemForm = () => {
	const [dirty, setDirty] = useState(true);
	const [error, setError] = useState<unknown>();
	const [saving, setSaving] = useState(false);
	const discard = useCallback(() => {
		formCalls.discard();
		setError(undefined);
		setDirty(false);
	}, []);
	const save = useCallback(async () => {
		setError(undefined);
		setSaving(true);
		try {
			await formCalls.save();
			setDirty(false);
		} catch (cause) {
			setError(cause);
			throw cause;
		} finally {
			setSaving(false);
		}
	}, []);
	const actions = useMemo<EditorFormActions>(
		() => ({
			discard,
			error,
			isDirty: dirty,
			isSaving: saving,
			save,
		}),
		[
			dirty,
			discard,
			error,
			save,
			saving,
		],
	);
	useRegisterEditorFormActions(actions);
	return createElement("p", null, "Item form");
};

interface TestRouterOptions {
	readonly initialEntry: string;
	readonly projectLoader?: () => Promise<void>;
}

const createTestRouter = ({ initialEntry, projectLoader }: TestRouterOptions) => {
	const rootRoute = createRootRoute();
	const editorRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId",
		component: () => createElement(EditorShell, null, createElement(Outlet)),
	});
	const editorListRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "editor/items/list",
		component: () => createElement("p", null, "Editor destination"),
	});
	const itemEditRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "editor/items/test/edit",
		component: DirtyItemForm,
	});
	const assetsRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "assets",
		component: () => createElement("p", null, "Assets destination"),
	});
	const projectRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "project",
		...(projectLoader === undefined
			? {}
			: {
					loader: projectLoader,
				}),
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
	return createRouter({
		routeTree: rootRoute.addChildren([
			editorRoute.addChildren([
				editorListRoute,
				itemEditRoute,
				assetsRoute,
				projectRoute,
				buildRoute,
				boardRoute,
			]),
			mainMenuRoute,
		]),
		history: createMemoryHistory({
			initialEntries: [
				initialEntry,
			],
		}),
		defaultPendingMs: 60_000,
	});
};

const renderRouter = async (router: ReturnType<typeof createTestRouter>) => {
	await router.load();
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				RegistryContext.Provider,
				{
					value: registry,
				},
				createElement(RouterProvider, {
					router,
				}),
			),
		);
	});
	return container;
};

const readLink = (container: HTMLElement, label: string) => {
	const link = [
		...container.querySelectorAll<HTMLAnchorElement>("a"),
	].find((candidate) => candidate.textContent === label);
	if (link === undefined) throw new Error(`Missing ${label} editor tab.`);
	return link;
};

const readButton = (container: HTMLElement, label: string) => {
	const button = [
		...container.querySelectorAll<HTMLButtonElement>("button"),
	].find((candidate) => candidate.textContent === label);
	if (button === undefined) throw new Error(`Missing ${label} editor action.`);
	return button;
};

const readStatusButton = (container: HTMLElement, label: string) => {
	const slot = container.querySelector('[data-ui="EditorFormStatusSlot"]');
	if (slot === null) throw new Error("Missing editor form status slot.");
	const button = [
		...slot.querySelectorAll<HTMLButtonElement>("button"),
	].find((candidate) => candidate.textContent === label);
	if (button === undefined) throw new Error(`Missing ${label} status action.`);
	return button;
};

describe("EditorShell", () => {
	beforeEach(() => {
		formCalls.discard.mockReset();
		formCalls.save.mockReset().mockResolvedValue(undefined);
	});

	it("switches the active tab before the destination route finishes loading", async () => {
		const projectLoader = createGate();
		const router = createTestRouter({
			initialEntry: "/editor/editor-test/build",
			projectLoader: () => projectLoader.promise,
		});
		const container = await renderRouter(router);
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
		act(() => {
			closeFailedListener?.(new Error("Native close failed."));
		});
		expect(container.textContent).toContain("Native close failed.");
	});

	it("exposes one shared Save action and the reserved dirty-form status bar", async () => {
		const router = createTestRouter({
			initialEntry: "/editor/editor-test/editor/items/test/edit",
		});
		const container = await renderRouter(router);

		expect(container.textContent).toContain("This form has unsaved changes.");
		expect(container.querySelector('[data-ui="EditorFormStatusSlot"]')).not.toBeNull();
		await act(async () => {
			readButton(container, "Save").click();
		});
		expect(formCalls.save).toHaveBeenCalledTimes(1);
		await vi.waitFor(() =>
			expect(container.textContent).not.toContain("This form has unsaved changes."),
		);
	});

	it("lets ordinary editor navigation discard local form state without a prompt", async () => {
		const router = createTestRouter({
			initialEntry: "/editor/editor-test/editor/items/test/edit",
		});
		const container = await renderRouter(router);

		await act(async () => {
			readLink(container, "Project").click();
		});
		expect(router.state.location.pathname).toBe("/editor/editor-test/project");
		expect(container.textContent).toContain("Project destination");
		expect(formCalls.save).not.toHaveBeenCalled();
		expect(formCalls.discard).not.toHaveBeenCalled();
	});

	it("asks only Exit to resolve dirty state and discards before leaving", async () => {
		const router = createTestRouter({
			initialEntry: "/editor/editor-test/editor/items/test/edit",
		});
		const container = await renderRouter(router);

		act(() => {
			readButton(container, "Exit").click();
		});
		expect(session.close).not.toHaveBeenCalled();
		expect(container.textContent).toContain(
			"Save or discard them before exiting.",
		);
		await act(async () => {
			readStatusButton(container, "Discard").click();
		});
		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/main-menu"),
		);
		expect(formCalls.discard).toHaveBeenCalledTimes(1);
		expect(session.close).toHaveBeenCalledTimes(1);
		expect(session.release).toHaveBeenCalledWith("editor-test");
	});

	it("saves dirty state before Exit and remains retryable after save failure", async () => {
		formCalls.save
			.mockRejectedValueOnce(new Error("Invalid item."))
			.mockResolvedValueOnce(undefined);
		const router = createTestRouter({
			initialEntry: "/editor/editor-test/editor/items/test/edit",
		});
		const container = await renderRouter(router);

		act(() => {
			readButton(container, "Exit").click();
		});
		await act(async () => {
			readStatusButton(container, "Save").click();
		});
		await vi.waitFor(() => expect(container.textContent).toContain("Invalid item."));
		expect(router.state.location.pathname).toBe(
			"/editor/editor-test/editor/items/test/edit",
		);
		expect(session.close).not.toHaveBeenCalled();

		await act(async () => {
			readStatusButton(container, "Save").click();
		});
		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/main-menu"),
		);
		expect(formCalls.save).toHaveBeenCalledTimes(2);
		expect(session.close).toHaveBeenCalledTimes(1);
	});
});
