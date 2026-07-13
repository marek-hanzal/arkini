import { Effect } from "effect";

export namespace invokeExternalCallbackFx {
	export interface Props<Value> {
		callback: (value: Value) => void;
		failureMessage: string;
		value: Value;
	}
}

/** Runs one external callback without allowing its defect to kill engine infrastructure. */
export const invokeExternalCallbackFx = Effect.fn("invokeExternalCallbackFx")(function* <Value>({
	callback,
	failureMessage,
	value,
}: invokeExternalCallbackFx.Props<Value>) {
	yield* Effect.sync(() => callback(value)).pipe(
		Effect.catchAllCause((cause) => Effect.logError(failureMessage, cause)),
	);
});
