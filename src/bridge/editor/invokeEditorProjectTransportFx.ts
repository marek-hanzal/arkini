import { Effect } from "effect";

import type { EditorProjectTransport } from "../../../electron/contract/editor/EditorProjectTransport";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/bridge/editor/EditorProjectRepositoryError";
import { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";

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
		Effect.flatMap((result) => {
			if (result.type === "failure") {
				return Effect.fail(
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
				);
			}
			return Effect.try({
				try: () => parse(result.value),
				catch: (cause) =>
					new EditorProjectRepositoryError({
						operation,
						message: responseMessage,
						cause,
					}),
			});
		}),
	);
