import { Deferred, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { match } from "ts-pattern";

import type {
	CloseItemDetailProps,
	ItemDetailState,
	ItemDetailTarget,
} from "~/ui/item-detail/ItemDetailControl";

interface ExitCompletion {
	readonly generation: number;
	readonly deferred: Deferred.Deferred<void>;
}

export interface ItemDetailController {
	readonly getSnapshot: () => ItemDetailController.Snapshot;
	readonly subscribe: (listener: () => void) => () => void;
	readonly readOrigin: (origin: HTMLElement | null) => HTMLElement | null;
	readonly readOutcomeScope: () => string | undefined;
	readonly openTargetFx: (target: ItemDetailTarget) => Effect.Effect<boolean>;
	readonly closeAtom: Atom.AtomResultFn<CloseItemDetailProps | undefined, void, never>;
	readonly closeFx: (props?: CloseItemDetailProps) => Effect.Effect<void>;
	readonly completeEnterFx: (generation: number) => Effect.Effect<void>;
	readonly completeExitFx: (generation: number) => Effect.Effect<void>;
	readonly resetFx: Effect.Effect<void>;
}

export namespace ItemDetailController {
	export interface Snapshot {
		readonly state: ItemDetailState;
	}
}

const closedState = {
	phase: "closed",
} as const satisfies ItemDetailState;

const initialSnapshot = {
	state: closedState,
} as const satisfies ItemDetailController.Snapshot;

const actionOutcomeScope = (state: ItemDetailState, outcomeEpoch: number) =>
	match(state)
		.with(
			{
				phase: "entering",
			},
			{
				phase: "open",
			},
			({ target }) => `${outcomeEpoch}\u0000${target.kind}\u0000${target.itemId}`,
		)
		.with(
			{
				phase: "closed",
			},
			{
				phase: "exiting",
			},
			() => undefined,
		)
		.exhaustive();

const sameActionOutcomeTarget = (left: ItemDetailTarget, right: ItemDetailTarget) =>
	left.kind === right.kind && left.itemId === right.itemId;

const sameTarget = (left: ItemDetailTarget, right: ItemDetailTarget) =>
	sameActionOutcomeTarget(left, right) &&
	left.tab === right.tab &&
	(left.kind !== "runtime" ||
		right.kind !== "runtime" ||
		left.linesSearchQuery === right.linesSearchQuery);

/**
 * Creates the non-React Item Detail state owner. Motion reports generation-keyed
 * enter/exit completion back here; callers awaiting close therefore finish only
 * after the visible modal has left or a superseding open intent has explicitly
 * taken ownership of that exit.
 *
 * Pending commands own only their exact command key. Repeated clicks on that
 * key coalesce until its engine command settles, while distinct commands remain
 * independent. Closing or switching the modal never waits for command
 * settlement; a late failure is published only while its exact admitting
 * target visit still owns the visible detail.
 */
export const createItemDetailControllerFx = Effect.fnUntraced(function* (): Generator<
	never,
	ItemDetailController,
	never
> {
	const listeners = new Set<() => void>();
	let snapshot: ItemDetailController.Snapshot = initialSnapshot;
	let nextGeneration = 0;
	let outcomeEpoch = 0;
	let exitCompletion: ExitCompletion | undefined;

	const publish = (next: ItemDetailController.Snapshot) => {
		snapshot = next;
		for (const listener of Array.from(listeners)) listener();
	};

	const publishState = (state: ItemDetailState) => {
		publish({
			state,
		});
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

	const enter = (target: ItemDetailTarget) => {
		outcomeEpoch += 1;
		publishState({
			phase: "entering",
			target,
			generation: ++nextGeneration,
		});
		return true;
	};

	const openTargetFx = Effect.fn("ItemDetailController.openTargetFx")(
		(target: ItemDetailTarget) =>
			Effect.gen(function* () {
				const current = snapshot.state;
				if (current.phase === "closed") return enter(target);
				// Resolve the superseded exit so its close waiter cannot hang.
				if (current.phase === "exiting") {
					yield* resolveExitCompletionFx(current.generation);
					return enter(target);
				}
				if (sameTarget(current.target, target)) return true;
				if (!sameActionOutcomeTarget(current.target, target)) outcomeEpoch += 1;
				publishState({
					...current,
					target,
				});
				return true;
			}),
	);

	const closeFx = Effect.fn("ItemDetailController.closeFx")(
		({ restoreFocus = true }: CloseItemDetailProps = {}) =>
			Effect.gen(function* () {
				const current = snapshot.state;
				if (current.phase === "closed") return;
				if (current.phase === "exiting") {
					if (!restoreFocus && current.restoreFocus) {
						publishState({
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
				publishState({
					phase: "exiting",
					target: current.target,
					generation: current.generation,
					restoreFocus,
				});
				yield* Deferred.await(deferred);
			}),
	);

	const closeAtom = Atom.fn((props: CloseItemDetailProps | undefined) => closeFx(props), {
		concurrent: true,
	}).pipe(Atom.setIdleTTL(0));

	const completeEnterFx = Effect.fn("ItemDetailController.completeEnterFx")(
		(generation: number) =>
			Effect.sync(() => {
				const current = snapshot.state;
				if (current.phase !== "entering" || current.generation !== generation) return;
				publishState({
					phase: "open",
					target: current.target,
					generation,
				});
			}),
	);

	const completeExitFx = Effect.fn("ItemDetailController.completeExitFx")((generation: number) =>
		Effect.gen(function* () {
			const current = snapshot.state;
			if (current.phase !== "exiting" || current.generation !== generation) return;
			publishState(closedState);
			yield* resolveExitCompletionFx(generation);
		}),
	);

	return {
		getSnapshot: () => snapshot,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		// References opened from inside Detail restore focus to the original scene actor.
		readOrigin: (origin) =>
			snapshot.state.phase === "closed" ? origin : snapshot.state.target.origin,
		readOutcomeScope: () => actionOutcomeScope(snapshot.state, outcomeEpoch),
		openTargetFx,
		closeAtom,
		closeFx,
		completeEnterFx,
		completeExitFx,
		resetFx: Effect.gen(function* () {
			yield* resolveExitCompletionFx();
			snapshot = initialSnapshot;
			nextGeneration = 0;
			outcomeEpoch = 0;
		}),
	};
});
