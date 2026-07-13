import { Effect, Fiber, Layer, Ref, Stream } from "effect";

import { CommittedTransitionsFx } from "~/v1/runtime/context/CommittedTransitionsFx";
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

/** Debounces committed transitions and serializes every save against the latest runtime. */
export const RuntimeSaveLayerFx = <Error>({
	debounceMs = 250,
	onError = defaultOnError,
	save,
}: RuntimeSaveLayerFx.Props<Error>) =>
	Layer.scoped(
		RuntimeSaveFx,
		Effect.gen(function* () {
			const committedTransitions = yield* CommittedTransitionsFx;
			const runtimeFx = yield* RuntimeFx;
			const lastSaved = yield* Ref.make<RuntimeSchema.Type | undefined>(undefined);
			const saveMutex = yield* Effect.makeSemaphore(1);

			const flush = saveMutex.withPermits(1)(
				Effect.all([
					runtimeFx.read,
					Ref.get(lastSaved),
				]).pipe(
					Effect.flatMap(([runtime, saved]) =>
						runtime === saved
							? Effect.void
							: fromRuntimeFx({
									runtime,
								}).pipe(
									Effect.flatMap(save),
									Effect.zipRight(Ref.set(lastSaved, runtime)),
								),
					),
				),
			);

			const stream = committedTransitions.changes.pipe(
				debounceMs > 0 ? Stream.debounce(`${debounceMs} millis`) : (value) => value,
				Stream.runForEach(() =>
					flush.pipe(Effect.catchAll((error) => Effect.sync(() => onError(error)))),
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
