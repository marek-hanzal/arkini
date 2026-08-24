import { Effect } from "effect";

import type { EditorProjectTransport } from "../../../contract/editor/EditorProjectTransport";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";

import type { EditorProjectServiceOwnership } from "../EditorProjectServiceOwnership";

/** Admits and runs one editor-project operation, then exposes its stable transport envelope. */
export const executeEditorProjectRepositoryFx = <Request, Value>(
	operation: EditorProjectTransport.Operation,
	ownership: EditorProjectServiceOwnership,
	requestFx: Effect.Effect<Request, EditorProjectRepositoryError>,
	run: (
		repository: EditorProjectRepositoryService,
		request: Request,
	) => Effect.Effect<Value, EditorProjectRepositoryError>,
): Effect.Effect<EditorProjectTransport.Result<Value>> =>
	requestFx.pipe(
		Effect.flatMap((request) =>
			ownership.type === "unavailable"
				? Effect.fail(
						new EditorProjectRepositoryError({
							operation,
							message: ownership.message,
						}),
					)
				: run(ownership.repository, request),
		),
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
