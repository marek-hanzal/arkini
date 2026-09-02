import { Effect } from "effect";

import type { EditorProjectTransport } from "~electron/contract/editor/EditorProjectTransport";
import { formatApplicationDiagnosticTextFn } from "~/application-diagnostics/fn/formatApplicationDiagnosticTextFn";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { DiagnosticLog } from "../../diagnostics/createDiagnosticLogFx";

import type {
	EditorProjectServiceOwnership,
	OwnedEditorProjectRepository,
} from "~/project-authoring/service/EditorProjectServiceOwnership";

type EditorProjectOperationPhase =
	| "request validation"
	| "service availability"
	| "repository execution";

const toTransportFailureFn = (
	error: ProjectRepositoryError,
): EditorProjectTransport.Result<never> => ({
	type: "failure",
	error: {
		operation: error.operation,
		message: error.message,
		...(error.diagnostics === undefined
			? {}
			: {
					diagnostics: error.diagnostics,
				}),
	},
});

const toApplicationFailureDetailFn = (error: ProjectRepositoryError) => ({
	name: error.name,
	message: error.message,
	...(error.stack === undefined
		? {}
		: {
				stack: error.stack,
			}),
	...(error.cause === undefined
		? {}
		: {
				cause: error.cause,
			}),
	...(error.diagnostics === undefined
		? {}
		: {
				diagnostics: error.diagnostics,
			}),
});

const reportFailureFx = (
	diagnostics: DiagnosticLog,
	phase: EditorProjectOperationPhase,
	error: ProjectRepositoryError,
) =>
	diagnostics
		.writeApplicationFx({
			level: "error",
			message: `Editor operation failed: ${error.operation}`,
			body: formatApplicationDiagnosticTextFn({
				value: toApplicationFailureDetailFn(error),
				prefix: `Phase: ${phase}`,
			}),
		})
		.pipe(
			Effect.catch(() => Effect.void),
			Effect.as(toTransportFailureFn(error)),
		);

/** Admits and runs one editor-project operation, then exposes its stable transport envelope. */
export const executeEditorProjectRepositoryFx = <Request, Value>(
	operation: EditorProjectTransport.Operation,
	ownership: EditorProjectServiceOwnership,
	diagnostics: DiagnosticLog,
	requestFx: Effect.Effect<Request, ProjectRepositoryError, never>,
	runFx: (
		repository: OwnedEditorProjectRepository,
		request: Request,
	) => Effect.Effect<Value, ProjectRepositoryError, never>,
): Effect.Effect<EditorProjectTransport.Result<Value>, never, never> =>
	requestFx.pipe(
		Effect.matchEffect({
			onFailure: (error) => reportFailureFx(diagnostics, "request validation", error),
			onSuccess: (request) => {
				if (ownership.type === "unavailable") {
					return reportFailureFx(
						diagnostics,
						"service availability",
						new ProjectRepositoryError({
							operation,
							message: ownership.message,
						}),
					);
				}
				return runFx(ownership.repository, request).pipe(
					Effect.matchEffect({
						onFailure: (error) =>
							reportFailureFx(diagnostics, "repository execution", error),
						onSuccess: (value) =>
							Effect.succeed({
								type: "success" as const,
								value,
							}),
					}),
				);
			},
		}),
	);
