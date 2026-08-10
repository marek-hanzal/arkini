// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectProvider } from "~/bridge/editor/EditorProjectProvider";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
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

beforeEach(() => {
	setProjectContext.mockClear();
	clearProjectContext.mockClear();
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
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

const createProject = (revision: number): EditorProject => ({
	projectId: "project",
	title: `Project ${revision}`,
	game: "1.0",
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
