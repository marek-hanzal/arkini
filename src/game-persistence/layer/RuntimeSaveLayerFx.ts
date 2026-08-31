import { Cause, Effect, Fiber, Layer, Ref, Semaphore, Stream } from "effect";

import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import { RuntimeSaveFx } from "~/game-persistence/service/RuntimeSaveFx";

interface Props<Error = unknown> {
	debounceMs?: number;
	onFatalError?: (cause: Cause.Cause<Error>) => void;
	save: (state: StateSchema.Type) => Effect.Effect<void, Error>;
}

/**
 * Owns autosave for one GameSession.
 *
 * Debounced commits, explicit flush and scope finalization share one mutex, so
 * durable writes cannot overtake each other. Gameplay owns the runtime; this
 * layer only converts the latest committed snapshot into persisted state.
 */
export const RuntimeSaveLayerFx = <Error>({
	debounceMs = 250,
	onFatalError = () => undefined,
	save,
}: Props<Error>) =>
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
								: save(
										fromRuntimeFn({
											runtime,
										}),
									).pipe(Effect.andThen(Ref.set(lastSaved, runtime))),
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
						Effect.onError((cause) =>
							Cause.hasInterruptsOnly(cause)
								? Effect.void
								: Effect.sync(() => onFatalError(cause)),
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
									Effect.catchCause((cause) =>
										Cause.hasInterruptsOnly(cause)
											? Effect.void
											: Effect.sync(() => onFatalError(cause)),
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
