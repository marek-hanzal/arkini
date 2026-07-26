import { Effect, Fiber, Layer, Ref, Semaphore, Stream } from "effect";

import { invokeExternalCallbackFx } from "~/engine/common/fx/invokeExternalCallbackFx";
import { CommittedTransitionsFx } from "~/engine/runtime/context/CommittedTransitionsFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { fromRuntimeFx } from "~/engine/state/fx/fromRuntimeFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { RuntimeSaveFx } from "~/bridge/save/RuntimeSaveFx";

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

/**
 * Owns autosave for one GameSession.
 *
 * Debounced commits, explicit flush and scope finalization share one mutex, so
 * durable writes cannot overtake each other. Gameplay owns the runtime; this
 * layer only converts the latest committed snapshot into persisted state.
 */
export const RuntimeSaveLayerFx = <Error>({
	debounceMs = 250,
	onError = defaultOnError,
	save,
}: RuntimeSaveLayerFx.Props<Error>) =>
	Layer.effect(
		RuntimeSaveFx,
		Effect.gen(function* () {
			const committedTransitions = yield* CommittedTransitionsFx;
			const runtimeFx = yield* RuntimeFx;
			const lastSaved = yield* Ref.make<RuntimeSchema.Type | undefined>(undefined);
			const discarded = yield* Ref.make(false);
			const saveMutex = yield* Semaphore.make(1);

			const flush = saveMutex.withPermits(1)(
				Effect.uninterruptible(
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
										Effect.andThen(Ref.set(lastSaved, runtime)),
									),
						),
					),
				),
			);

			const stream = committedTransitions.changes.pipe(
				Stream.map((transition) => transition.runtime),
				Stream.changesWith(Object.is),
				debounceMs > 0 ? Stream.debounce(`${debounceMs} millis`) : (value) => value,
				Stream.runForEach(() =>
					flush.pipe(
						Effect.catch((error) =>
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
			const consumer = yield* Effect.forkScoped(stream, {
				startImmediately: true,
			});
			// Reset first stops the consumer, then joins any in-flight write before disposal.
			const discard = Ref.set(discarded, true).pipe(
				Effect.andThen(Fiber.interrupt(consumer)),
				Effect.andThen(saveMutex.withPermits(1)(Effect.void)),
			);

			// Normal scope closure stops future debounce work before the final flush.
			yield* Effect.addFinalizer(() =>
				Fiber.interrupt(consumer).pipe(
					Effect.andThen(Ref.get(discarded)),
					Effect.flatMap((shouldDiscard) =>
						shouldDiscard
							? Effect.void
							: flush.pipe(
									Effect.catch((error) =>
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
				discard,
				flush,
			};
		}),
	);
