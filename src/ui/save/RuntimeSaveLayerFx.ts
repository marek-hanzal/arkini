import { Effect, Fiber, Layer, Ref, Stream } from "effect";

import { invokeExternalCallbackFx } from "~/engine/common/fx/invokeExternalCallbackFx";
import { CommittedTransitionsFx } from "~/engine/runtime/context/CommittedTransitionsFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { fromRuntimeFx } from "~/engine/state/fx/fromRuntimeFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { RuntimeSaveFx } from "~/ui/save/RuntimeSaveFx";

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

/** Debounces committed runtime identities and serializes saves against the latest runtime. */
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
			const discarded = yield* Ref.make(false);
			const saveMutex = yield* Effect.makeSemaphore(1);

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
										Effect.zipRight(Ref.set(lastSaved, runtime)),
									),
						),
					),
				),
			);

			const stream = Stream.make(subscription.current).pipe(
				Stream.concat(subscription.changes),
				Stream.map((transition) => transition.runtime),
				Stream.changesWith(Object.is),
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
			const discard = Ref.set(discarded, true).pipe(
				Effect.zipRight(Fiber.interrupt(consumer)),
				Effect.zipRight(saveMutex.withPermits(1)(Effect.void)),
			);

			yield* Effect.addFinalizer(() =>
				Fiber.interrupt(consumer).pipe(
					Effect.zipRight(Ref.get(discarded)),
					Effect.flatMap((shouldDiscard) =>
						shouldDiscard
							? Effect.void
							: flush.pipe(
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
				discard,
				flush,
			};
		}),
	);
