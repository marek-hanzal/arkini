// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/editor/EditorProject";
import { EditorProjectAtom } from "~/ui/editor/EditorProjectAtom";
import { EditorProjectProvider } from "~/ui/editor/EditorProjectProvider";
import { RendererAtomRegistry } from "~/renderer/RendererAtomRegistry";
import { useEditorProject } from "~/ui/editor/useEditorProject";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];
const setProjectContext = vi.fn(() => Promise.resolve());
const clearProjectContext = vi.fn(() => Promise.resolve());
const readProject = vi.fn();
let projectChangedListener: ((projectId: string) => void) | undefined;

beforeEach(() => {
	setProjectContext.mockClear();
	clearProjectContext.mockClear();
	readProject.mockReset();
	projectChangedListener = undefined;
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			editor: {
				onProjectChanged: (listener: (projectId: string) => void) => {
					projectChangedListener = listener;
					return () => {
						projectChangedListener = undefined;
					};
				},
				readProject,
			},
			editorMcp: {
				setProjectContext,
				clearProjectContext,
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
	Reflect.deleteProperty(window, "arkini");
});

const createProject = (revision: number, projectId = "project"): EditorProject => ({
	projectId,
	title: `Project ${revision}`,
	version: "1.0",
	createdAtMs: 1,
	updatedAtMs: 1,
	revision,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
});

describe("EditorProjectProvider", () => {
	it("owns the MCP context only while its project workspace is mounted", async () => {
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
					createElement(EditorProjectProvider, {
						loaded: createProject(1),
						children: null,
					}),
				),
			);
		});

		expect(setProjectContext).toHaveBeenCalledExactlyOnceWith("project");
		expect(clearProjectContext).not.toHaveBeenCalled();

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		expect(clearProjectContext).toHaveBeenCalledExactlyOnceWith("project");
	});

	it("replaces a retained project snapshot with the fresh remount loader result", async () => {
		const revisionA = 1;
		const revisionB = 2;
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		registry.set(EditorProjectAtom("project"), {
			project: createProject(revisionA),
		});
		const Probe = () => createElement("output", null, useEditorProject().revision);
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
					createElement(
						EditorProjectProvider,
						{
							loaded: createProject(revisionB),
						},
						createElement(Probe),
					),
				),
			);
		});

		expect(container.textContent).toBe(String(revisionB));
		expect(registry.get(EditorProjectAtom("project"))?.revision).toBe(revisionB);
	});

	it("keeps the newest canonical project when MCP reloads finish out of order", async () => {
		const projectId = "mcp-refresh-project";
		const pendingReads: Array<(result: unknown) => void> = [];
		readProject.mockImplementation(
			() =>
				new Promise((resolve) => {
					pendingReads.push(resolve);
				}),
		);
		const Probe = () => createElement("output", null, useEditorProject().revision);
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: RendererAtomRegistry,
					},
					createElement(
						EditorProjectProvider,
						{
							loaded: createProject(1, projectId),
						},
						createElement(Probe),
					),
				),
			);
		});
		await act(async () => {
			projectChangedListener?.("another-project");
			projectChangedListener?.(projectId);
			projectChangedListener?.(projectId);
			await vi.waitFor(() => expect(pendingReads).toHaveLength(2));
		});
		await act(async () => {
			pendingReads[1]?.({
				type: "success",
				value: {
					...createProject(3, projectId),
					title: editorTestPayload.config.meta.title,
				},
			});
			await vi.waitFor(() => expect(container.textContent).toBe("3"));
		});
		await act(async () => {
			pendingReads[0]?.({
				type: "success",
				value: {
					...createProject(2, projectId),
					title: editorTestPayload.config.meta.title,
				},
			});
			await Promise.resolve();
		});

		expect(readProject).toHaveBeenCalledTimes(2);
		expect(container.textContent).toBe("3");
	});

	it("rejects a loader result when a newer project was published after loading began", async () => {
		const revisionB = 2;
		const revisionC = 3;
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		registry.set(EditorProjectAtom("project"), {
			project: createProject(revisionB),
		});
		registry.set(EditorProjectAtom("project"), {
			project: createProject(revisionC),
		});
		const Probe = () => createElement("output", null, useEditorProject().revision);
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
					createElement(
						EditorProjectProvider,
						{
							loaded: createProject(revisionB),
						},
						createElement(Probe),
					),
				),
			);
		});

		expect(container.textContent).toBe(String(revisionC));
		expect(registry.get(EditorProjectAtom("project"))?.revision).toBe(revisionC);
	});
});
