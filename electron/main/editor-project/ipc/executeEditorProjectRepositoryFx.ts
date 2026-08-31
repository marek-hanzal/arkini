import { Effect } from "effect";

import type { EditorProjectTransport } from "../../../contract/editor/EditorProjectTransport";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";

import type {
	EditorProjectServiceOwnership,
	OwnedEditorProjectRepository,
} from "../EditorProjectServiceOwnership";

/** Admits and runs one editor-project operation, then exposes its stable transport envelope. */
export const executeEditorProjectRepositoryFx = <Request, Value>(
	operation: EditorProjectTransport.Operation,
	ownership: EditorProjectServiceOwnership,
	requestFx: Effect.Effect<Request, ProjectRepositoryError>,
	run: (
		repository: OwnedEditorProjectRepository,
		request: Request,
	) => Effect.Effect<Value, ProjectRepositoryError>,
): Effect.Effect<EditorProjectTransport.Result<Value>> =>
	requestFx.pipe(
		Effect.flatMap((request) =>
			ownership.type === "unavailable"
				? Effect.fail(
						new ProjectRepositoryError({
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
					...(error.diagnostics === undefined
						? {}
						: {
								diagnostics: error.diagnostics,
							}),
				},
			}),
			onSuccess: (value) => ({
				type: "success" as const,
				value,
			}),
		}),
	);
