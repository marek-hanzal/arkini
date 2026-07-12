import { Effect, Fiber, Layer, Ref, Stream } from "effect";

import { RuntimeChangesFx } from "~/v1/runtime/context/RuntimeChangesFx";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { fromRuntimeFx } from "~/v1/state/fx/fromRuntimeFx";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
import { RuntimeSaveFx } from "~/v1/ui/save/RuntimeSaveFx";

export namespace RuntimeSaveLayerFx {
	export interface Props<Error = unknown> {
		debounceMs?: number;
		onError?: (error: Error) => void;
		save: (state: StateSchema.Type) => Effect.Effect<void, Error>;
	}
}

const defaultOnError = (error: unknown) => {
	console.error("Arkini autosave failed; the latest runtime remains pending.", error);
};

/** Debounces committed runtime snapshots and flushes the latest one on session teardown. */
export const RuntimeSaveLayerFx = <Error>({
	debounceMs = 250,
	onError = defaultOnError,
	save,
}: RuntimeSaveLayerFx.Props<Error>) =>
	Layer.scoped(
		RuntimeSaveFx,
		Effect.gen(function* () {
			const runtimeChanges = yield* RuntimeChangesFx;
			const runtimeFx = yield* RuntimeFx;
			const lastSaved = yield* Ref.make<RuntimeSchema.Type | undefined>(undefined);

			const persistRuntimeFx = (runtime: RuntimeSchema.Type) =>
				fromRuntimeFx({
					runtime,
				}).pipe(
					Effect.flatMap(save),
					Effect.tap(() => Ref.set(lastSaved, runtime)),
				);

			const flush = Effect.all([
				runtimeFx.read,
				Ref.get(lastSaved),
			]).pipe(
				Effect.flatMap(([runtime, saved]) =>
					runtime === saved ? Effect.void : persistRuntimeFx(runtime),
				),
			);

			const stream = runtimeChanges.changes.pipe(
				Stream.drop(1),
				debounceMs > 0 ? Stream.debounce(`${debounceMs} millis`) : (value) => value,
				Stream.runForEach((runtime) =>
					persistRuntimeFx(runtime).pipe(
						Effect.catchAll((error) => Effect.sync(() => onError(error))),
					),
				),
			);
			const consumer = yield* Effect.forkScoped(stream);

			yield* Effect.addFinalizer(() =>
				Fiber.interrupt(consumer).pipe(
					Effect.zipRight(
						flush.pipe(Effect.catchAll((error) => Effect.sync(() => onError(error)))),
					),
				),
			);

			return {
				flush,
			};
		}),
	);
