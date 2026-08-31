// @vitest-environment jsdom

import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProjectTransport } from "~electron/contract/editor/EditorProjectTransport";
import { createElectronEditorBuildRepositoryFx } from "~/editor-build/fx/createElectronEditorBuildRepositoryFx";
import { createProjectWriteAdmissionFx } from "~/project-authoring/fx/createProjectWriteAdmissionFx";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";

const installBuildApi = () => {
	const buildProject = vi.fn<Window["arkini"]["editor"]["buildProject"]>();
	const readProjectBuild = vi.fn<Window["arkini"]["editor"]["readProjectBuild"]>();
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			editor: {
				buildProject,
				readProjectBuild,
			},
		},
	});
	return {
		buildProject,
		readProjectBuild,
	};
};

const readTypedFailure = async <Value>(effect: Effect.Effect<Value, unknown>) => {
	const exit = await Effect.runPromiseExit(effect);
	if (Exit.isSuccess(exit)) throw new Error("Expected the Editor Build request to fail.");
	const failure = Cause.findErrorOption(exit.cause);
	if (Option.isNone(failure)) throw new Error("Expected a typed Editor Build failure.");
	return failure.value;
};

const createRepository = () => {
	const admission = Effect.runSync(createProjectWriteAdmissionFx);
	return Effect.runSync(
		createElectronEditorBuildRepositoryFx.pipe(
			Effect.provideService(ProjectWriteAdmission, admission),
		),
	);
};

afterEach(() => {
	Reflect.deleteProperty(window, "arkini");
});

describe("Editor Build createElectronEditorBuildRepositoryFx", () => {
	it("preserves structured Build diagnostics across the renderer IPC boundary", async () => {
		const editor = installBuildApi();
		const diagnostics = [
			{
				code: DiagnosticCodeEnumSchema.enum.ResourceMissing,
				severity: "error" as const,
				message: "Referenced resource item-water has no matching PNG file.",
				path: [
					"items",
					"water",
					"asset",
					"default",
					0,
				],
				source: "items/simple/water.json",
				resourceId: "item-water",
			},
		];
		editor.buildProject.mockResolvedValueOnce({
			type: "failure",
			error: {
				operation: "build-project",
				message: "Editor project project-one could not be built.",
				diagnostics,
			},
		});
		const repository = createRepository();

		const failure = await readTypedFailure(
			repository.buildProjectFx({
				projectId: "project-one",
				expectedRevision: 2,
			}),
		);

		expect(failure).toMatchObject({
			diagnostics,
		});
	});

	it("rejects malformed Build diagnostics as a typed boundary failure", async () => {
		const editor = installBuildApi();
		editor.buildProject.mockResolvedValueOnce({
			type: "failure",
			error: {
				operation: "build-project",
				message: "Malformed diagnostics must not escape the boundary.",
				diagnostics: [
					"not-a-diagnostic",
				],
			},
		} as EditorProjectTransport.Result<never>);
		const repository = createRepository();

		const failure = await readTypedFailure(
			repository.buildProjectFx({
				projectId: "project-one",
				expectedRevision: 2,
			}),
		);

		expect(failure).toMatchObject({
			operation: "build-project",
			message: "The editor IPC response is invalid.",
		});
	});
});
