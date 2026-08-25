import { Effect } from "effect";

import type { EditorProjectTransport } from "../../../electron/contract/editor/EditorProjectTransport";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/bridge/editor/EditorProjectRepositoryError";

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
				return Effect.fail(new EditorProjectRepositoryError(result.error));
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
