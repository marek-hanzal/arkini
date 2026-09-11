// @vitest-environment jsdom

import { RegistryContext, useAtomValue } from "@effect/atom-react";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RendererAtomRegistry } from "~/application-runtime/atom/RendererAtomRegistry";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { Detail } from "~/item-authoring/ui/Detail";
import { DeleteSection } from "~/item-authoring/ui/DeleteSection";
import { NotFound } from "~/item-authoring/ui/NotFound";
import { useItemByUid } from "~/item-authoring/ui/useItemByUid";
import type { Project, ProjectCommit } from "~/project-authoring/type/Project";
import { TranslationContext } from "~/translation/ui/TranslationContext";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

const projectId = "project-one";
const projectAtom = EditorProjectAtom(projectId);
const itemPath = "/editor/project-one/editor/items/water/detail/delete";
const listPath = "/editor/project-one/editor/items/list";

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => {
		const project = useAtomValue(projectAtom);
		if (project === undefined) throw new Error("Missing test project.");
		return project;
	},
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
	vi.unstubAllGlobals();
});

const createGate = <Value,>() => {
	let resolve!: (value: Value) => void;
	const promise = new Promise<Value>((resolveFn) => {
		resolve = resolveFn;
	});
	return {
		promise,
		resolve,
	};
};

const createFixture = async ({ force = false, history = true } = {}) => {
	const project: Project = {
		projectId,
		title: editorTestPayload.config.meta.title,
		version: {
			major: 1,
			minor: 0,
		},
		createdAtMs: 1,
		updatedAtMs: 1,
		revision: 0,
		config: {
			...editorTestPayload.config,
			start: {
				...editorTestPayload.config.start,
				board: force ? editorTestPayload.config.start.board : [],
			},
		},
		resources: [],
	};
	const { water: _water, ...items } = project.config.items;
	const commit: ProjectCommit = {
		projectId,
		title: project.title,
		version: project.version,
		createdAtMs: 1,
		updatedAtMs: 2,
		previousRevision: 0,
		revision: 1,
		config: {
			...project.config,
			items,
			start: {
				...project.config.start,
				board: [],
			},
		},
	};
	const deletion = createGate<unknown>();
	const navigation = createGate<void>();
	const deleteItemFn = vi.fn(() => deletion.promise);
	vi.stubGlobal("arkini", {
		editor: {
			deleteItemFn,
		},
	});
	const unmountProject = RendererAtomRegistry.mount(projectAtom);
	RendererAtomRegistry.set(projectAtom, {
		replacement: project,
	});

	const DetailRoute = () => {
		const item = useItemByUid("water");
		return (
			<Detail
				uid="water"
				sectionId="delete"
			>
				{item === undefined ? <NotFound uid="water" /> : <DeleteSection item={item} />}
			</Detail>
		);
	};
	const ListRoute = () => {
		const current = useEditorProject();
		return <div data-ui="TestItemList">{Object.keys(current.config.items).join(",")}</div>;
	};
	const rootRoute = createRootRoute();
	const listLoader = vi.fn(() => navigation.promise);
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			createRoute({
				getParentRoute: () => rootRoute,
				path: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
				component: DetailRoute,
			}),
			createRoute({
				getParentRoute: () => rootRoute,
				path: "/editor/$projectId/editor/items/list",
				loader: listLoader,
				component: ListRoute,
			}),
		]),
		history: createMemoryHistory({
			initialEntries: history
				? [
						"/editor/project-one/editor/items/water/detail/identity",
						itemPath,
					]
				: [
						itemPath,
					],
		}),
		defaultPendingMs: 60_000,
	});
	await router.load();
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const missingFrames: string[] = [];
	const observer = new MutationObserver((records) => {
		for (const record of records) {
			for (const node of record.addedNodes) {
				if (
					node instanceof Element &&
					(node.matches('[data-ui="EditorItemNotFound"]') ||
						node.querySelector('[data-ui="EditorItemNotFound"]') !== null)
				)
					missingFrames.push(node.textContent ?? "");
			}
		}
	});
	observer.observe(container, {
		childList: true,
		subtree: true,
	});
	cleanups.push(async () => {
		deletion.resolve({
			type: "failure",
			error: {
				operation: "delete-item",
				message: "Stopped.",
			},
		});
		navigation.resolve();
		await act(async () => root.unmount());
		observer.disconnect();
		container.remove();
		unmountProject();
	});
	await act(async () => {
		root.render(
			<RegistryContext.Provider value={RendererAtomRegistry}>
				<TranslationContext
					value={{
						textFn: (key) => key,
					}}
				>
					<RouterProvider router={router} />
				</TranslationContext>
			</RegistryContext.Provider>,
		);
	});
	const click = async (marker: string) => {
		const button = container.querySelector<HTMLButtonElement>(`[data-ui="${marker}"]`);
		if (button === null) throw new Error(`Missing ${marker}.`);
		await act(async () => button.click());
	};
	await click(force ? "EditorItemForceDeleteOpen" : "EditorItemDeleteOpen");
	await click("EditorItemDeleteConfirm");
	return {
		commit,
		container,
		deleteItemFn,
		deletion,
		listLoader,
		missingFrames,
		navigation,
		router,
	};
};

describe("DeleteSection", () => {
	it.each([
		{
			force: false,
			history: true,
		},
		{
			force: true,
			history: false,
		},
	])("leaves detail before publishing a deleted item: %o", async (options) => {
		const fixture = await createFixture(options);
		expect(fixture.deleteItemFn).toHaveBeenCalledWith({
			projectId,
			itemUid: "water",
			expectedRevision: 0,
			force: options.force,
		});
		expect(fixture.listLoader).not.toHaveBeenCalled();
		await act(async () => {
			fixture.deletion.resolve({
				type: "success",
				value: fixture.commit,
			});
			await vi.waitFor(() => expect(fixture.listLoader).toHaveBeenCalledOnce());
		});
		expect(fixture.missingFrames).toEqual([]);
		expect(
			fixture.container.querySelector('[data-ui="EditorItemDeleteConfirm"]'),
		).not.toBeNull();

		await act(async () => fixture.navigation.resolve());
		expect(fixture.router.state.location.pathname).toBe(listPath);
		expect(fixture.router.history.length).toBe(options.history ? 2 : 1);
		expect(fixture.container.querySelector('[data-ui="TestItemList"]')).not.toBeNull();
		expect(RendererAtomRegistry.get(projectAtom)?.revision).toBe(1);
		expect(RendererAtomRegistry.get(projectAtom)?.config.items.water).toBeUndefined();
		expect(fixture.missingFrames).toEqual([]);
	});

	it("keeps detail and project data when deletion fails", async () => {
		const fixture = await createFixture();
		await act(async () =>
			fixture.deletion.resolve({
				type: "failure",
				error: {
					operation: "delete-item",
					message: "Delete failed.",
				},
			}),
		);
		expect(fixture.container.textContent).toContain("Delete failed.");
		expect(fixture.router.state.location.pathname).toBe(itemPath);
		expect(fixture.listLoader).not.toHaveBeenCalled();
		expect(RendererAtomRegistry.get(projectAtom)?.revision).toBe(0);
		expect(fixture.missingFrames).toEqual([]);
	});
});
