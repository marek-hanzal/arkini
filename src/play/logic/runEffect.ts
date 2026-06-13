import { Effect } from "effect";

export function runEffect<T>(effect: Effect.Effect<T, unknown, never>) {
	return Effect.runPromise(effect);
}
