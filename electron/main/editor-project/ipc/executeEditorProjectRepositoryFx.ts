import { Effect } from "effect";

import type { EditorProjectTransport } from "../../../contract/editor/EditorProjectTransport";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import type { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";

import type { EditorProjectServiceOwnership } from "../EditorProjectServiceOwnership";

/** Runs one editor-project repository operation and exposes only its stable transport envelope. */
export const executeEditorProjectRepositoryFx = <Value>(
	operation: EditorProjectTransport.Operation,
	ownership: EditorProjectServiceOwnership,
	run: (
		repository: EditorProjectRepositoryService,
	) => Effect.Effect<Value, EditorProjectRepositoryError>,
): Effect.Effect<EditorProjectTransport.Result<Value>> => {
	if (ownership.type === "unavailable") {
		return Effect.succeed({
			type: "failure",
			error: {
				operation,
				message: ownership.message,
			},
		});
	}
	return run(ownership.repository).pipe(
		Effect.match({
			onFailure: (error) => ({
				type: "failure" as const,
				error: {
					operation: error.operation,
					message: error.message,
				},
			}),
			onSuccess: (value) => ({
				type: "success" as const,
				value,
			}),
		}),
	);
};
