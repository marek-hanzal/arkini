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

const createProject = (revision: string): EditorProject => ({
	projectId: "project",
	title: `Project ${revision[0]}`,
	createdAtMs: 1,
	updatedAtMs: 1,
	revision,
	resources: [],
	resourceSourcePaths: {},
	itemSourcePaths: {},
	diagnostics: [],
});

describe("EditorProjectProvider", () => {
	it("replaces a retained project snapshot with the fresh remount loader result", async () => {
		const revisionA = "a".repeat(64);
		const revisionB = "b".repeat(64);
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		registry.set(EditorProjectAtom("project"), {
			action: "refresh",
			expectedRevision: revisionA,
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
							expectedRevision: revisionA,
							loaded: createProject(revisionB),
						},
						createElement(Probe),
					),
				),
			);
		});

		expect(container.textContent).toBe(revisionB);
		expect(registry.get(EditorProjectAtom("project"))?.revision).toBe(revisionB);
	});

	it("rejects a loader result when a newer project was published after loading began", async () => {
		const revisionB = "b".repeat(64);
		const revisionC = "c".repeat(64);
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		registry.set(EditorProjectAtom("project"), {
			action: "refresh",
			expectedRevision: revisionB,
			project: createProject(revisionB),
		});
		registry.set(EditorProjectAtom("project"), {
			action: "publish",
			expectedRevision: revisionB,
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
							expectedRevision: revisionB,
							loaded: createProject(revisionB),
						},
						createElement(Probe),
					),
				),
			);
		});

		expect(container.textContent).toBe(revisionC);
		expect(registry.get(EditorProjectAtom("project"))?.revision).toBe(revisionC);
	});
});
