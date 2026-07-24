import { Effect } from "effect";

export namespace invokeExternalCallbackFx {
	export interface Props<Value> {
		callback: (value: Value) => void | PromiseLike<void>;
		failureMessage: string;
		value: Value;
	}
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
	(typeof value === "object" && value !== null) || typeof value === "function"
		? "then" in value && typeof value.then === "function"
		: false;

const reportExternalCallbackFailureFx = Effect.fn("reportExternalCallbackFailureFx")(
	({ failureMessage, cause }: { readonly failureMessage: string; readonly cause: unknown }) =>
		Effect.logError(failureMessage, cause),
);

/**
 * Runs one external callback without allowing synchronous defects or rejected
 * returned PromiseLike work to kill or block engine infrastructure.
 */
export const invokeExternalCallbackFx = Effect.fn("invokeExternalCallbackFx")(function* <Value>({
	callback,
	failureMessage,
	value,
}: invokeExternalCallbackFx.Props<Value>) {
	yield* Effect.sync(() => callback(value)).pipe(
		Effect.flatMap((result) => {
			if (!isPromiseLike(result)) return Effect.void;

			return Effect.promise((_signal) => Promise.resolve(result)).pipe(
				Effect.catchCause((cause) =>
					reportExternalCallbackFailureFx({
						failureMessage,
						cause,
					}),
				),
				Effect.forkChild({
					startImmediately: true,
				}),
				Effect.asVoid,
			);
		}),
		Effect.catchCause((cause) =>
			reportExternalCallbackFailureFx({
				failureMessage,
				cause,
			}),
		),
	);
});
