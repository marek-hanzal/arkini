import { Effect } from "effect";

export function runFx<T>(effect: Effect.Effect<T, unknown, never>) {
	return Effect.runPromise(effect);
}
