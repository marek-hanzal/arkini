import { Effect } from "effect";
import { toGameActionError } from "./toGameActionError";

export function tryGameAction<T>(run: () => Promise<T>) {
	return Effect.tryPromise({
		try: run,
		catch: toGameActionError,
	});
}
