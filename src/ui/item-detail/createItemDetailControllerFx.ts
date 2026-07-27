import { Deferred, Effect, Fiber } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { match } from "ts-pattern";

import type {
	CloseItemDetailProps,
	ItemDetailPendingAction,
	ItemDetailState,
	ItemDetailTarget,
	RunItemDetailPendingActionProps,
} from "~/ui/item-detail/ItemDetailControl";

interface ExitCompletion {
	readonly generation: number;
	readonly deferred: Deferred.Deferred<void>;
}

export interface ItemDetailController {
	readonly getSnapshot: () => ItemDetailController.Snapshot;
	readonly subscribe: (listener: () => void) => () => void;
	readonly readOrigin: (origin: HTMLElement | null) => HTMLElement | null;
	readonly openTargetFx: (target: ItemDetailTarget) => Effect.Effect<boolean>;
	readonly closeAtom: Atom.AtomResultFn<CloseItemDetailProps | undefined, void, never>;
	readonly closeFx: (props?: CloseItemDetailProps) => Effect.Effect<void>;
	readonly completeEnterFx: (generation: number) => Effect.Effect<void>;
	readonly completeExitFx: (generation: number) => Effect.Effect<void>;
	readonly readActionError: (key: string) => string | null;
	readonly readPendingAction: (key: string) => ItemDetailPendingAction | null;
	readonly cancelPendingActionsFx: Effect.Effect<void>;
	readonly runPendingActionFx: <Result, Failure>(
		props: RunItemDetailPendingActionProps<Result, Failure>,
	) => Effect.Effect<Result | void, Failure>;
	readonly resetFx: Effect.Effect<void>;
}

export namespace ItemDetailController {
	export interface Snapshot {
		readonly state: ItemDetailState;
		readonly pendingActions: ReadonlyMap<string, ItemDetailPendingAction>;
		/**
		 * Presentation-only failure messages retained across tab remounts for the
		 * same target. Command settlement remains owned by each command Atom.
		 */
		readonly actionErrors: ReadonlyMap<string, string>;
	}
}

const closedState = {
	phase: "closed",
} as const satisfies ItemDetailState;

const initialSnapshot = {
	state: closedState,
	pendingActions: new Map(),
	actionErrors: new Map(),
} as const satisfies ItemDetailController.Snapshot;

const actionOutcomeScope = (state: ItemDetailState) =>
	match(state)
		.with(
			{
				phase: "entering",
			},
			{
				phase: "open",
			},
			({ generation, target }) => `${generation}\u0000${target.kind}\u0000${target.itemId}`,
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
 * settlement; a late failure is published only while its admitting target
 * generation still owns the visible detail.
 */
export const createItemDetailControllerFx = Effect.fn("createItemDetailControllerFx")(() =>
	Effect.sync((): ItemDetailController => {
		const listeners = new Set<() => void>();
		const actionFibers = new Set<Fiber.Fiber<unknown, unknown>>();
		const actionTokenByKey = new Map<string, symbol>();
		let snapshot: ItemDetailController.Snapshot = initialSnapshot;
		let nextGeneration = 0;
		let exitCompletion: ExitCompletion | undefined;

		const publish = (next: ItemDetailController.Snapshot) => {
			snapshot = next;
			for (const listener of Array.from(listeners)) listener();
		};

		const publishState = (
			state: ItemDetailState,
			{
				clearActionErrors = false,
			}: {
				readonly clearActionErrors?: boolean;
			} = {},
		) => {
			publish({
				...snapshot,
				state,
				actionErrors: clearActionErrors ? new Map() : snapshot.actionErrors,
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
			publishState(
				{
					phase: "entering",
					target,
					generation: ++nextGeneration,
				},
				{
					clearActionErrors: true,
				},
			);
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
					publishState(
						{
							...current,
							target,
						},
						{
							clearActionErrors: !sameActionOutcomeTarget(current.target, target),
						},
					);
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
					publishState(
						{
							phase: "exiting",
							target: current.target,
							generation: current.generation,
							restoreFocus,
						},
						{
							clearActionErrors: true,
						},
					);
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

		const completeExitFx = Effect.fn("ItemDetailController.completeExitFx")(
			(generation: number) =>
				Effect.gen(function* () {
					const current = snapshot.state;
					if (current.phase !== "exiting" || current.generation !== generation) return;
					publishState(closedState);
					yield* resolveExitCompletionFx(generation);
				}),
		);

		const runPendingActionFx: ItemDetailController["runPendingActionFx"] = Effect.fn(
			"ItemDetailController.runPendingActionFx",
		)(
			<Result, Failure>({
				key,
				action,
				failureMessage,
				run,
			}: RunItemDetailPendingActionProps<Result, Failure>) =>
				Effect.suspend((): Effect.Effect<Result | void, Failure> => {
					if (
						snapshot.state.phase === "closed" ||
						snapshot.state.phase === "exiting" ||
						snapshot.pendingActions.has(key)
					) {
						return Effect.void;
					}
					const outcomeScope = actionOutcomeScope(snapshot.state);
					const pendingActions = new Map(snapshot.pendingActions);
					pendingActions.set(key, action);
					const actionToken = Symbol(key);
					actionTokenByKey.set(key, actionToken);
					const actionErrors = new Map(snapshot.actionErrors);
					actionErrors.delete(key);
					publish({
						...snapshot,
						pendingActions,
						actionErrors,
					});

					return Effect.gen(function* () {
						const fiber = yield* run.pipe(
							Effect.tapError((error) =>
								Effect.sync(() => {
									if (
										outcomeScope !== undefined &&
										actionOutcomeScope(snapshot.state) === outcomeScope &&
										actionTokenByKey.get(key) === actionToken
									) {
										const nextErrors = new Map(snapshot.actionErrors);
										nextErrors.set(
											key,
											error instanceof Error ? error.message : failureMessage,
										);
										publish({
											...snapshot,
											actionErrors: nextErrors,
										});
									}
								}),
							),
							Effect.ensuring(
								Effect.sync(() => {
									if (actionTokenByKey.get(key) !== actionToken) return;
									actionTokenByKey.delete(key);
									const nextPending = new Map(snapshot.pendingActions);
									nextPending.delete(key);
									publish({
										...snapshot,
										pendingActions: nextPending,
									});
								}),
							),
							Effect.exit,
							Effect.forkDetach({
								startImmediately: true,
							}),
						);
						actionFibers.add(fiber);
						fiber.addObserver(() => actionFibers.delete(fiber));
						const outcome = yield* Fiber.join(fiber);
						return yield* outcome;
					});
				}),
		);

		const cancelPendingActionsFx = Effect.sync(() => {
			for (const fiber of actionFibers) fiber.interruptUnsafe();
			actionFibers.clear();
			actionTokenByKey.clear();
			if (snapshot.pendingActions.size === 0 && snapshot.actionErrors.size === 0) return;
			publish({
				...snapshot,
				pendingActions: new Map(),
				actionErrors: new Map(),
			});
		});

		return {
			getSnapshot: () => snapshot,
			subscribe: (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
			// References opened from inside Detail restore focus to the original scene actor.
			readOrigin: (origin) =>
				snapshot.state.phase === "closed" ? origin : snapshot.state.target.origin,
			openTargetFx,
			closeAtom,
			closeFx,
			completeEnterFx,
			completeExitFx,
			readActionError: (key) => snapshot.actionErrors.get(key) ?? null,
			readPendingAction: (key) => snapshot.pendingActions.get(key) ?? null,
			cancelPendingActionsFx,
			runPendingActionFx,
			resetFx: Effect.gen(function* () {
				yield* cancelPendingActionsFx;
				yield* resolveExitCompletionFx();
				snapshot = initialSnapshot;
				nextGeneration = 0;
			}),
		};
	}),
);
