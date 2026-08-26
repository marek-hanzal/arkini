import { Effect } from "effect";
import { z } from "zod";

import { invokeEditorProjectTransportFx } from "~/bridge/editor/invokeEditorProjectTransportFx";
import type { EditorProjectBuildSchema } from "~/editor/EditorProjectBuildSchema";

/** Saves the canonical Arkpack and optional signature through one native dialog. */
export const saveBuiltEditorArkpackFx = Effect.fn("saveBuiltEditorArkpackFx")(
	(artifact: EditorProjectBuildSchema.Type) =>
		invokeEditorProjectTransportFx<boolean, boolean>({
			call: () =>
				window.arkini.editor.saveProjectBuild({
					projectId: artifact.projectId,
					expectedRevision: artifact.revision,
					contentHash: artifact.contentHash,
					signed: artifact.signed,
				}),
			operation: "save-project-build",
			parse: (value) => z.boolean().parse(value),
			requestMessage: "The Editor build save request failed.",
			responseMessage: "The Editor build save response is invalid.",
		}),
);
