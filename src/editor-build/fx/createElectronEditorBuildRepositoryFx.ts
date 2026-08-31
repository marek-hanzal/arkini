import { Effect } from "effect";

import type { EditorBuildRepositoryService } from "~/editor-build/service/EditorBuildRepository";
import {
	EditorProjectBuildContentSchema,
	EditorProjectBuildSchema,
} from "~/editor-build/schema/EditorProjectBuildSchema";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { invokeProjectTransportFx } from "~/project-authoring/fx/invokeProjectTransportFx";

/** Creates the Electron-backed proxy for exact revision-pinned Editor Build operations. */
export const createElectronEditorBuildRepositoryFx = Effect.gen(function* () {
	const admission = yield* ProjectWriteAdmission;
	return {
		buildProjectFx: (request) =>
			admission.admitWriteFx(
				"build-project",
				invokeProjectTransportFx({
					callFn: () => window.arkini.editor.buildProjectFn(request),
					operation: "build-project",
					parseFn: (value) => EditorProjectBuildSchema.parse(value),
					requestMessage: "The editor IPC request failed.",
					responseMessage: "The editor IPC response is invalid.",
				}),
			),
		readProjectBuildFx: (request) =>
			invokeProjectTransportFx({
				callFn: () => window.arkini.editor.readProjectBuildFn(request),
				operation: "read-project-build",
				parseFn: (value) => EditorProjectBuildContentSchema.parse(value),
				requestMessage: "The editor IPC request failed.",
				responseMessage: "The editor IPC response is invalid.",
			}),
	} satisfies EditorBuildRepositoryService;
});
