import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import { invokeProjectTransportFx } from "~/project-authoring/fx/invokeProjectTransportFx";

/** Saves one exact Editor Build artifact through the privileged native dialog. */
export const saveEditorBuildFx = Effect.fn("saveEditorBuildFx")(
	(artifact: EditorProjectBuildSchema.Type) =>
		invokeProjectTransportFx({
			callFn: () =>
				window.arkini.editor.saveProjectBuildFn({
					projectId: artifact.projectId,
					expectedRevision: artifact.revision,
					contentHash: artifact.contentHash,
				}),
			operation: "save-project-build",
			parseFn: (value) => z.boolean().parse(value),
			requestMessage: "The Editor build save request failed.",
			responseMessage: "The Editor build save response is invalid.",
		}),
);
