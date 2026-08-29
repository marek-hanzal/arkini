import { Effect } from "effect";

import type { EditorBuildRepositoryService } from "~/editor-build/domain/EditorBuildRepository";
import {
	EditorProjectBuildContentSchema,
	EditorProjectBuildSchema,
} from "~/editor-build/domain/EditorProjectBuildSchema";
import { admitEditorProjectWriteFx } from "~/project-authoring/repository/EditorProjectWriteAdmission";
import { invokeEditorProjectTransportFx } from "~/renderer/editor/invokeEditorProjectTransportFx";

/** Creates the renderer proxy for exact revision-pinned Editor Build operations. */
export const createElectronEditorBuildRepositoryFx = Effect.sync(
	(): EditorBuildRepositoryService => ({
		buildProjectFx: (request) =>
			admitEditorProjectWriteFx(
				"build-project",
				invokeEditorProjectTransportFx({
					call: () => window.arkini.editor.buildProject(request),
					operation: "build-project",
					parse: (value) => EditorProjectBuildSchema.parse(value),
					requestMessage: "The editor IPC request failed.",
					responseMessage: "The editor IPC response is invalid.",
				}),
			),
		readProjectBuildFx: (request) =>
			invokeEditorProjectTransportFx({
				call: () => window.arkini.editor.readProjectBuild(request),
				operation: "read-project-build",
				parse: (value) => EditorProjectBuildContentSchema.parse(value),
				requestMessage: "The editor IPC request failed.",
				responseMessage: "The editor IPC response is invalid.",
			}),
	}),
);
