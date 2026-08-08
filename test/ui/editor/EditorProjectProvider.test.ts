// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

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

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	document.body.replaceChildren();
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
