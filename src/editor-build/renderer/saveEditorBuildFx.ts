import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import { invokeEditorProjectTransportFx } from "~/project-authoring/fx/invokeEditorProjectTransportFx";

/** Saves one exact local Editor Build artifact through the privileged native dialog. */
export const saveEditorBuildFx = Effect.fn("saveEditorBuildFx")(
	(artifact: EditorProjectBuildSchema.Type) =>
		invokeEditorProjectTransportFx({
			call: () =>
				window.arkini.editor.saveProjectBuild({
					projectId: artifact.projectId,
					expectedRevision: artifact.revision,
					contentHash: artifact.contentHash,
				}),
			operation: "save-project-build",
			parse: (value) => z.boolean().parse(value),
			requestMessage: "The Editor build save request failed.",
			responseMessage: "The Editor build save response is invalid.",
		}),
);
