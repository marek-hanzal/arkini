import { Effect } from "effect";
import { toGameActionError } from "~/v0/play/action/toGameActionError";

export function tryGameActionFx<T>(run: () => Promise<T>) {
	return Effect.tryPromise({
		try: run,
		catch: toGameActionError,
	});
}
