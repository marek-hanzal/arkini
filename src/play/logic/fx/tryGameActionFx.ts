import { Effect } from "effect";
import { toGameActionError } from "./toGameActionError";

export function tryGameActionFx<T>(run: () => Promise<T>) {
	return Effect.tryPromise({
		try: run,
		catch: toGameActionError,
	});
}
