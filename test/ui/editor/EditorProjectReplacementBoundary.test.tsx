// @vitest-environment jsdom

import { RegistryContext, scheduleTask, useAtomValue } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement, type PropsWithChildren, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectContext } from "~/bridge/editor/EditorProjectContext";
import { EditorProjectReplacementEpochAtom } from "~/bridge/editor/EditorProjectReplacementEpochAtom";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { EditorProjectReplacementBoundary } from "~/ui/editor/EditorProjectReplacementBoundary";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];
const projectAtom = EditorProjectAtom("project");

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
	version: "1.0",
	createdAtMs: 1,
	updatedAtMs: 1,
	revision,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
});

const ProjectContextOwner = ({ children }: PropsWithChildren) => {
	const project = useAtomValue(projectAtom);
	if (project === undefined) throw new Error("Test project is missing.");
	return <EditorProjectContext value={project}>{children}</EditorProjectContext>;
};

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
						ProjectContextOwner,
						null,
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
