import { Deferred, Effect } from "effect";

import type {
	CloseItemDetailProps,
	ItemDetailState,
	ItemDetailTarget,
} from "~/item-detail-frame/type/ItemDetailControl";

interface ExitCompletion {
	readonly generation: number;
	readonly deferred: Deferred.Deferred<void>;
}

interface ItemDetailController {
	readonly getSnapshotFn: () => ItemDetailState;
	readonly subscribeFn: (listenerFn: () => void) => () => void;
	readonly readOriginFn: (origin: HTMLElement | null) => HTMLElement | null;
	readonly openTargetFx: (target: ItemDetailTarget) => Effect.Effect<boolean, never, never>;
	readonly closeFx: (props?: CloseItemDetailProps) => Effect.Effect<void, never, never>;
	readonly completeEnterFx: (generation: number) => Effect.Effect<void, never, never>;
	readonly completeExitFx: (generation: number) => Effect.Effect<void, never, never>;
	readonly resetFx: Effect.Effect<void, never, never>;
}

const closedState = {
	phase: "closed",
} as const satisfies ItemDetailState;

const sameTargetFn = (left: ItemDetailTarget, right: ItemDetailTarget) =>
	left.kind === "runtime"
		? right.kind === "runtime" && left.itemId === right.itemId
		: right.kind === "definition" && left.itemUid === right.itemUid;

/**
 * Creates the non-React Item Detail state owner. Motion reports generation-keyed
 * enter/exit completion back here; callers awaiting close therefore finish only
 * after the visible modal has left or a superseding open intent has explicitly
 * taken ownership of that exit.
 */
export const createItemDetailControllerFx = Effect.fnUntraced(function* (): Generator<
	never,
	ItemDetailController,
	never
> {
	const listeners = new Set<() => void>();
	let state: ItemDetailState = closedState;
	let nextGeneration = 0;
	let exitCompletion: ExitCompletion | undefined;

	const publishFn = (next: ItemDetailState) => {
		state = next;
		for (const listenerFn of Array.from(listeners)) listenerFn();
	};

	const resolveExitCompletionFx = Effect.fn("ItemDetailController.resolveExitCompletionFx")(
		(generation?: number) =>
			Effect.gen(function* () {
				const completion = exitCompletion;
				if (
					completion === undefined ||
					(generation !== undefined && completion.generation !== generation)
				) {
					return;
				}
				exitCompletion = undefined;
				yield* Deferred.succeed(completion.deferred, undefined);
			}),
	);

	const enterFn = (target: ItemDetailTarget) => {
		publishFn({
			phase: "entering",
			target,
			generation: ++nextGeneration,
		});
		return true;
	};

	const openTargetFx = Effect.fn("ItemDetailController.openTargetFx")(
		(target: ItemDetailTarget) =>
			Effect.gen(function* () {
				const current = state;
				if (current.phase === "closed") return enterFn(target);
				// Resolve the superseded exit so its close waiter cannot hang.
				if (current.phase === "exiting") {
					yield* resolveExitCompletionFx(current.generation);
					return enterFn(target);
				}
				if (sameTargetFn(current.target, target)) return true;
				publishFn({
					...current,
					target,
				});
				return true;
			}),
	);

	const closeFx = Effect.fn("ItemDetailController.closeFx")(
		({ restoreFocus = true }: CloseItemDetailProps = {}) =>
			Effect.gen(function* () {
				const current = state;
				if (current.phase === "closed") return;
				if (current.phase === "exiting") {
					if (!restoreFocus && current.restoreFocus) {
						publishFn({
							...current,
							restoreFocus: false,
						});
					}
					if (exitCompletion !== undefined) {
						yield* Deferred.await(exitCompletion.deferred);
					}
					return;
				}

				const deferred = yield* Deferred.make<void>();
				exitCompletion = {
					generation: current.generation,
					deferred,
				};
				publishFn({
					phase: "exiting",
					target: current.target,
					generation: current.generation,
					restoreFocus,
				});
				yield* Deferred.await(deferred);
			}),
	);

	const completeEnterFx = Effect.fn("ItemDetailController.completeEnterFx")(
		(generation: number) =>
			Effect.sync(() => {
				const current = state;
				if (current.phase !== "entering" || current.generation !== generation) return;
				publishFn({
					phase: "open",
					target: current.target,
					generation,
				});
			}),
	);

	const completeExitFx = Effect.fn("ItemDetailController.completeExitFx")((generation: number) =>
		Effect.gen(function* () {
			const current = state;
			if (current.phase !== "exiting" || current.generation !== generation) return;
			publishFn(closedState);
			yield* resolveExitCompletionFx(generation);
		}),
	);

	return {
		getSnapshotFn: () => state,
		subscribeFn: (listenerFn) => {
			listeners.add(listenerFn);
			return () => listeners.delete(listenerFn);
		},
		// References opened from inside Detail restore focus to the original scene actor.
		readOriginFn: (origin) => (state.phase === "closed" ? origin : state.target.origin),
		openTargetFx,
		closeFx,
		completeEnterFx,
		completeExitFx,
		resetFx: Effect.gen(function* () {
			yield* resolveExitCompletionFx();
			state = closedState;
			nextGeneration = 0;
		}),
	};
});
