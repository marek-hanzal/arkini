import { Effect, Fiber, Layer, Ref, Stream } from "effect";

import { invokeExternalCallbackFx } from "~/v1/common/fx/invokeExternalCallbackFx";
import { CommittedTransitionsFx } from "~/v1/runtime/context/CommittedTransitionsFx";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { fromRuntimeFx } from "~/v1/state/fx/fromRuntimeFx";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
import { RuntimeSaveFx } from "~/v1/ui/save/RuntimeSaveFx";

export namespace RuntimeSaveLayerFx {
	export interface Props<Error = unknown> {
		debounceMs?: number;
		onError?: (error: Error) => void | PromiseLike<void>;
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
			const subscription = yield* committedTransitions.subscribe;
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

			const stream = Stream.make(subscription.current).pipe(
				Stream.concat(subscription.changes),
				debounceMs > 0 ? Stream.debounce(`${debounceMs} millis`) : (value) => value,
				Stream.runForEach(() =>
					flush.pipe(
						Effect.catchAll((error) =>
							invokeExternalCallbackFx({
								callback: onError,
								failureMessage:
									"Arkini autosave error callback failed; the save consumer remains active.",
								value: error,
							}),
						),
					),
				),
			);
			const consumer = yield* Effect.forkScoped(stream);

			yield* Effect.addFinalizer(() =>
				Fiber.interrupt(consumer).pipe(
					Effect.zipRight(
						flush.pipe(
							Effect.catchAll((error) =>
								invokeExternalCallbackFx({
									callback: onError,
									failureMessage:
										"Arkini autosave error callback failed during finalization.",
									value: error,
								}),
							),
						),
					),
				),
			);

			return {
				flush,
			};
		}),
	);
