import { Effect } from "effect";

import type { EditorProjectTransport } from "~electron/contract/editor/EditorProjectTransport";
import {
	ProjectRepositoryError,
	type ProjectRepositoryOperation,
} from "~/project-authoring/error/ProjectRepositoryError";
import { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";

const parseEnvelope = <Value>(candidate: unknown): EditorProjectTransport.Result<Value> => {
	if (typeof candidate !== "object" || candidate === null || !("type" in candidate)) {
		throw new Error("Editor IPC returned no result envelope.");
	}
	if (candidate.type === "success" && "value" in candidate) {
		return candidate as EditorProjectTransport.Result<Value>;
	}
	if (
		candidate.type === "failure" &&
		"error" in candidate &&
		typeof candidate.error === "object" &&
		candidate.error !== null &&
		"operation" in candidate.error &&
		"message" in candidate.error &&
		typeof candidate.error.operation === "string" &&
		typeof candidate.error.message === "string"
	) {
		return candidate as EditorProjectTransport.Result<Value>;
	}
	throw new Error("Editor IPC returned an invalid result envelope.");
};

export const invokeProjectTransportFx = <Value, Output>({
	call,
	operation,
	parse,
	requestMessage,
	responseMessage,
}: {
	readonly call: () => Promise<EditorProjectTransport.Result<Value>>;
	readonly operation: ProjectRepositoryOperation;
	readonly parse: (value: Value) => Output;
	readonly requestMessage: string;
	readonly responseMessage: string;
}) =>
	Effect.tryPromise({
		try: call,
		catch: (cause) =>
			new ProjectRepositoryError({
				operation,
				message: requestMessage,
				cause,
			}),
	}).pipe(
		Effect.flatMap((candidate) =>
			Effect.try({
				try: () => parseEnvelope<Value>(candidate),
				catch: (cause) =>
					new ProjectRepositoryError({
						operation,
						message: responseMessage,
						cause,
					}),
			}),
		),
		Effect.flatMap((result) => {
			if (result.type === "success") {
				return Effect.try({
					try: () => parse(result.value),
					catch: (cause) =>
						new ProjectRepositoryError({
							operation,
							message: responseMessage,
							cause,
						}),
				});
			}
			return Effect.try({
				try: () =>
					new ProjectRepositoryError({
						operation: result.error.operation,
						message: result.error.message,
						...(result.error.diagnostics === undefined
							? {}
							: {
									diagnostics: GameDiagnosticsSchema.parse(
										result.error.diagnostics,
									),
								}),
					}),
				catch: (cause) =>
					new ProjectRepositoryError({
						operation,
						message: responseMessage,
						cause,
					}),
			}).pipe(Effect.flatMap((failure) => Effect.fail(failure)));
		}),
	);
