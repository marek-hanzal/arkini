import { Effect } from "effect";

import type { EditorProjectTransport } from "../../../electron/contract/editor/EditorProjectTransport";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/project-authoring/repository/EditorProjectRepositoryError";
import { GameDiagnosticsSchema } from "~/game-config/diagnostic/schema/GameDiagnosticsSchema";

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

export const invokeEditorProjectTransportFx = <Value, Output>({
	call,
	operation,
	parse,
	requestMessage,
	responseMessage,
}: {
	readonly call: () => Promise<EditorProjectTransport.Result<Value>>;
	readonly operation: EditorProjectRepositoryOperation;
	readonly parse: (value: Value) => Output;
	readonly requestMessage: string;
	readonly responseMessage: string;
}) =>
	Effect.tryPromise({
		try: call,
		catch: (cause) =>
			new EditorProjectRepositoryError({
				operation,
				message: requestMessage,
				cause,
			}),
	}).pipe(
		Effect.flatMap((candidate) =>
			Effect.try({
				try: () => parseEnvelope<Value>(candidate),
				catch: (cause) =>
					new EditorProjectRepositoryError({
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
						new EditorProjectRepositoryError({
							operation,
							message: responseMessage,
							cause,
						}),
				});
			}
			return Effect.try({
				try: () =>
					new EditorProjectRepositoryError({
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
					new EditorProjectRepositoryError({
						operation,
						message: responseMessage,
						cause,
					}),
			}).pipe(Effect.flatMap((failure) => Effect.fail(failure)));
		}),
	);
