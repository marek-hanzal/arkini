import { Deferred, Effect } from "effect";
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
	readonly closeFx: (props?: CloseItemDetailProps) => Effect.Effect<void>;
	readonly completeEnterFx: (generation: number) => Effect.Effect<void>;
	readonly completeExitFx: (generation: number) => Effect.Effect<void>;
	readonly readActionError: (key: string) => string | null;
	readonly readPendingAction: (key: string) => ItemDetailPendingAction | null;
	readonly runPendingActionFx: (props: RunItemDetailPendingActionProps) => Effect.Effect<unknown>;
	readonly resetFx: Effect.Effect<void>;
}

export namespace ItemDetailController {
	export interface Snapshot {
		readonly state: ItemDetailState;
		readonly pendingActions: ReadonlyMap<string, ItemDetailPendingAction>;
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
	sameActionOutcomeTarget(left, right) && left.tab === right.tab;

/** Creates one owner for Item Detail lifecycle and command settlement state. */
export const createItemDetailControllerFx = Effect.fn("createItemDetailControllerFx")(() =>
	Effect.sync((): ItemDetailController => {
		const listeners = new Set<() => void>();
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

		const resolveExitCompletionFx = (generation?: number) =>
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
			});

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

		const openTargetFx = (target: ItemDetailTarget) =>
			Effect.gen(function* () {
				const current = snapshot.state;
				if (current.phase === "closed") return enter(target);
				if (snapshot.pendingActions.size > 0 && !sameTarget(current.target, target)) {
					return false;
				}
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
			});

		const closeFx = ({ restoreFocus = true }: CloseItemDetailProps = {}) =>
			Effect.gen(function* () {
				const current = snapshot.state;
				if (current.phase === "closed") return;
				if (snapshot.pendingActions.size > 0) return;
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
			});

		const completeEnterFx = (generation: number) =>
			Effect.sync(() => {
				const current = snapshot.state;
				if (current.phase !== "entering" || current.generation !== generation) return;
				publishState({
					phase: "open",
					target: current.target,
					generation,
				});
			});

		const completeExitFx = (generation: number) =>
			Effect.gen(function* () {
				const current = snapshot.state;
				if (current.phase !== "exiting" || current.generation !== generation) return;
				publishState(closedState);
				yield* resolveExitCompletionFx(generation);
			});

		const runPendingActionFx = ({
			key,
			action,
			failureMessage,
			run,
		}: RunItemDetailPendingActionProps) =>
			Effect.suspend(() => {
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
				const actionErrors = new Map(snapshot.actionErrors);
				actionErrors.delete(key);
				publish({
					...snapshot,
					pendingActions,
					actionErrors,
				});

				return Effect.tryPromise({
					try: run,
					catch: (cause) => cause,
				}).pipe(
					Effect.catchAll((cause) =>
						Effect.sync(() => {
							if (
								outcomeScope !== undefined &&
								actionOutcomeScope(snapshot.state) === outcomeScope
							) {
								const nextErrors = new Map(snapshot.actionErrors);
								nextErrors.set(
									key,
									cause instanceof Error ? cause.message : failureMessage,
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
							if (snapshot.pendingActions.get(key) !== action) return;
							const nextPending = new Map(snapshot.pendingActions);
							nextPending.delete(key);
							publish({
								...snapshot,
								pendingActions: nextPending,
							});
						}),
					),
				);
			});

		return {
			getSnapshot: () => snapshot,
			subscribe: (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
			readOrigin: (origin) =>
				snapshot.state.phase === "closed" ? origin : snapshot.state.target.origin,
			openTargetFx,
			closeFx,
			completeEnterFx,
			completeExitFx,
			readActionError: (key) => snapshot.actionErrors.get(key) ?? null,
			readPendingAction: (key) => snapshot.pendingActions.get(key) ?? null,
			runPendingActionFx,
			resetFx: Effect.gen(function* () {
				yield* resolveExitCompletionFx();
				snapshot = initialSnapshot;
				nextGeneration = 0;
			}),
		};
	}),
);
