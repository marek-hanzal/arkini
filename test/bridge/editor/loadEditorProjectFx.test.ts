import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { loadEditorProjectFx } from "~/bridge/editor/loadEditorProjectFx";

const createProject = (): EditorProject => ({
	projectId: "project",
	title: "Project",
	createdAtMs: 1,
	updatedAtMs: 2,
	revision: "a".repeat(64),
	fileIndex: {},
	itemSourcePaths: {},
	resources: [],
	resourceSourcePaths: {},
	diagnostics: [],
});

describe("loadEditorProjectFx", () => {
	it("reuses the canonical in-memory project without reading Electron again", async () => {
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		const project = createProject();
		registry.set(EditorProjectAtom(project.projectId), {
			action: "refresh",
			expectedRevision: undefined,
			project,
		});

		await expect(
			Effect.runPromise(
				loadEditorProjectFx({
					projectId: project.projectId,
				}).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)),
			),
		).resolves.toEqual({
			expectedRevision: project.revision,
			project,
		});
		registry.dispose();
	});
});
