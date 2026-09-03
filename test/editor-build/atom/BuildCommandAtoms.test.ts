import { scheduleTask } from "@effect/atom-react";
import { Cause, Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	buildProjectFx: vi.fn(),
}));

vi.mock("~/editor-build/service/EditorBuildRepository", async () => {
	const { Effect } = await import("effect");
	return {
		EditorBuildRepository: Effect.succeed({
			buildProjectFx: state.buildProjectFx,
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

import { BuildCommandAtoms } from "~/editor-build/atom/BuildCommandAtoms";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";

const registries: AtomRegistry.AtomRegistry[] = [];

beforeEach(() => {
	state.buildProjectFx.mockReset();
});

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("BuildCommandAtoms", () => {
	it("retains the last project validation failure across route unmount and remount", async () => {
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
		const buildAtom = BuildCommandAtoms.build("editor-test");
		const unmount = registry.mount(buildAtom);

		registry.set(buildAtom, {
			expectedRevision: 3,
		});
		await vi.waitFor(() => expect(AsyncResult.isFailure(registry.get(buildAtom))).toBe(true));
		unmount();
		await new Promise((resolve) => setTimeout(resolve, 20));

		const remount = registry.mount(buildAtom);
		const result = registry.get(buildAtom);
		expect(AsyncResult.isFailure(result)).toBe(true);
		if (AsyncResult.isFailure(result)) expect(Cause.squash(result.cause)).toBe(failure);
		expect(state.buildProjectFx).toHaveBeenCalledTimes(1);
		remount();
	});
});
