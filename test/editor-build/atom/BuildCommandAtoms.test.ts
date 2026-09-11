import { scheduleTask } from "@effect/atom-react";
import { Cause, Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	buildProjectFx: vi.fn(),
	saveBuildVersionFx: vi.fn(),
}));

vi.mock("~/editor-build/service/EditorBuildRepository", async () => {
	const { Effect } = await import("effect");
	return {
		EditorBuildRepository: Effect.succeed({
			buildProjectFx: state.buildProjectFx,
			saveBuildVersionFx: state.saveBuildVersionFx,
		}),
	};
});

vi.mock("~/application-runtime/service/RendererRuntime", async () => {
	const { Effect } = await import("effect");
	return {
		RendererRuntime: {
			runSync: Effect.runSync,
		},
	};
});

import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { BuildCommandAtoms } from "~/editor-build/atom/BuildCommandAtoms";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";

const registries: AtomRegistry.AtomRegistry[] = [];

beforeEach(() => {
	state.buildProjectFx.mockReset();
	state.saveBuildVersionFx
		.mockReset()
		.mockImplementation(({ version }) => Effect.succeed(version));
});

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("BuildCommandAtoms", () => {
	it("remembers output version without an authoring revision even when Build fails across route remount", async () => {
		const failure = new ProjectRepositoryError({
			operation: "build-project",
			message: "Editor project validation failed.",
			diagnostics: [
				{
					code: "resource:unused",
					severity: "warning",
					message: "The asset is not referenced by the project.",
					path: [
						"resources",
						"unused-asset",
					],
					resourceId: "unused-asset",
				},
			],
		});
		state.buildProjectFx.mockReturnValue(Effect.fail(failure));
		const registry = AtomRegistry.make({
			defaultIdleTTL: 10,
			scheduleTask,
		});
		registries.push(registry);
		const projectAtom = EditorProjectAtom("editor-test");
		const unmountProject = registry.mount(projectAtom);
		registry.set(projectAtom, {
			project: {
				projectId: "editor-test",
				title: "Editor test",
				revision: 3,
				version: {
					major: 1,
					minor: 0,
				},
				createdAtMs: 1,
				updatedAtMs: 1,
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			},
		});
		const buildAtom = BuildCommandAtoms.build("editor-test");
		const unmount = registry.mount(buildAtom);

		registry.set(buildAtom, {
			expectedRevision: 3,
			version: {
				major: 2,
				minor: 1,
				suffix: "demo",
			},
		});
		await vi.waitFor(() => expect(AsyncResult.isFailure(registry.get(buildAtom))).toBe(true));
		unmount();
		await new Promise((resolve) => setTimeout(resolve, 20));

		const remount = registry.mount(buildAtom);
		const result = registry.get(buildAtom);
		expect(AsyncResult.isFailure(result)).toBe(true);
		if (AsyncResult.isFailure(result)) expect(Cause.squash(result.cause)).toBe(failure);
		expect(state.buildProjectFx).toHaveBeenCalledTimes(1);
		expect(registry.get(projectAtom)).toMatchObject({
			revision: 3,
			version: {
				major: 2,
				minor: 1,
				suffix: "demo",
			},
		});
		expect(state.buildProjectFx).toHaveBeenCalledWith({
			projectId: "editor-test",
			expectedRevision: 3,
			expectedVersion: {
				major: 2,
				minor: 1,
				suffix: "demo",
			},
		});
		remount();
		unmountProject();
	});
});
