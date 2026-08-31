// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Project } from "~/project-authoring/type/Project";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { EditorProjectReplacementEpochAtom } from "~/authoring-session/atom/EditorProjectReplacementEpochAtom";
import { EditorProjectProvider, useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorProjectReplacementBoundary } from "~/authoring-session/ui/EditorProjectReplacementBoundary";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];
const projectAtom = EditorProjectAtom("project");

beforeEach(() => {
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			editor: {
				onProjectChanged: () => () => undefined,
			},
			editorMcp: {
				clearProjectContext: () => Promise.resolve(),
				setProjectContext: () => Promise.resolve(),
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

const createProject = (revision: number): Project => ({
	projectId: "project",
	title: `Project ${revision}`,
	version: "1.0",
	createdAtMs: 1,
	updatedAtMs: 1,
	revision,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
});

describe("EditorProjectReplacementBoundary", () => {
	it("remounts only after an explicit whole-project replacement", async () => {
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		registry.set(projectAtom, {
			project: createProject(1),
		});
		let mount = 0;
		const Probe = () => {
			const [mountedAs] = useState(() => ++mount);
			const project = useEditorProject();
			return createElement("output", null, `${project.revision}:${mountedAs}`);
		};
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
							loaded: createProject(1),
						},
						createElement(EditorProjectReplacementBoundary, null, createElement(Probe)),
					),
				),
			);
		});
		expect(container.textContent).toBe("1:1");

		await act(async () => {
			registry.set(projectAtom, {
				project: createProject(2),
			});
		});
		expect(container.textContent).toBe("2:1");

		await act(async () => {
			registry.set(EditorProjectReplacementEpochAtom("project"), 1);
		});
		expect(container.textContent).toBe("2:2");
	});
});
