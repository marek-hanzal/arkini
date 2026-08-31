import { Effect } from "effect";

import type { EditorBuildRepositoryService } from "~/editor-build/service/EditorBuildRepository";
import {
	EditorProjectBuildContentSchema,
	EditorProjectBuildSchema,
} from "~/editor-build/schema/EditorProjectBuildSchema";
import { admitEditorProjectWriteFx } from "~/project-authoring/service/EditorProjectWriteAdmission";
import { invokeEditorProjectTransportFx } from "~/project-authoring/fx/invokeEditorProjectTransportFx";

/** Creates the Electron-backed proxy for exact revision-pinned Editor Build operations. */
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
