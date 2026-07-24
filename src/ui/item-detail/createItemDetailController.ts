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
	readonly promise: Promise<void>;
	readonly resolve: () => void;
}

export interface ItemDetailController {
	readonly getSnapshot: () => ItemDetailController.Snapshot;
	readonly subscribe: (listener: () => void) => () => void;
	readonly readOrigin: (origin: HTMLElement | null) => HTMLElement | null;
	readonly openTarget: (target: ItemDetailTarget) => boolean;
	readonly close: (props?: CloseItemDetailProps) => Promise<void>;
	readonly completeEnter: (generation: number) => void;
	readonly completeExit: (generation: number) => void;
	readonly readActionError: (key: string) => string | null;
	readonly readPendingAction: (key: string) => ItemDetailPendingAction | null;
	readonly runPendingAction: (props: RunItemDetailPendingActionProps) => Promise<unknown>;
	readonly reset: () => void;
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

/** Creates one synchronous owner for Item Detail lifecycle and command settlement state. */
export const createItemDetailController = (): ItemDetailController => {
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

	const resolveExitCompletion = (generation?: number) => {
		const completion = exitCompletion;
		if (
			completion === undefined ||
			(generation !== undefined && completion.generation !== generation)
		) {
			return;
		}
		exitCompletion = undefined;
		completion.resolve();
	};

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

	const openTarget = (target: ItemDetailTarget) =>
		match(snapshot.state)
			.with(
				{
					phase: "closed",
				},
				() => enter(target),
			)
			.with(
				{
					phase: "entering",
				},
				{
					phase: "open",
				},
				(current) => {
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
				},
			)
			.with(
				{
					phase: "exiting",
				},
				(current) => {
					resolveExitCompletion(current.generation);
					return enter(target);
				},
			)
			.exhaustive();

	const close = ({ restoreFocus = true }: CloseItemDetailProps = {}) =>
		match(snapshot.state)
			.with(
				{
					phase: "closed",
				},
				() => Promise.resolve(),
			)
			.with(
				{
					phase: "entering",
				},
				{
					phase: "open",
				},
				(current) => {
					let resolve: () => void = () => undefined;
					const promise = new Promise<void>((complete) => {
						resolve = complete;
					});
					exitCompletion = {
						generation: current.generation,
						promise,
						resolve,
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
					return promise;
				},
			)
			.with(
				{
					phase: "exiting",
				},
				(current) => {
					if (!restoreFocus && current.restoreFocus) {
						publishState({
							...current,
							restoreFocus: false,
						});
					}
					return exitCompletion?.promise ?? Promise.resolve();
				},
			)
			.exhaustive();

	const completeEnter = (generation: number) => {
		const current = snapshot.state;
		if (current.phase !== "entering" || current.generation !== generation) return;
		publishState({
			phase: "open",
			target: current.target,
			generation,
		});
	};

	const completeExit = (generation: number) => {
		const current = snapshot.state;
		if (current.phase !== "exiting" || current.generation !== generation) return;
		publishState(closedState);
		resolveExitCompletion(generation);
	};

	const runPendingAction = async ({
		key,
		action,
		failureMessage,
		run,
	}: RunItemDetailPendingActionProps) => {
		if (snapshot.pendingActions.has(key)) return;
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
		try {
			return await run();
		} catch (cause) {
			if (outcomeScope !== undefined && actionOutcomeScope(snapshot.state) === outcomeScope) {
				const nextErrors = new Map(snapshot.actionErrors);
				nextErrors.set(key, cause instanceof Error ? cause.message : failureMessage);
				publish({
					...snapshot,
					actionErrors: nextErrors,
				});
			}
		} finally {
			if (snapshot.pendingActions.get(key) === action) {
				const nextPending = new Map(snapshot.pendingActions);
				nextPending.delete(key);
				publish({
					...snapshot,
					pendingActions: nextPending,
				});
			}
		}
	};

	return {
		getSnapshot: () => snapshot,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		readOrigin: (origin) =>
			snapshot.state.phase === "closed" ? origin : snapshot.state.target.origin,
		openTarget,
		close,
		completeEnter,
		completeExit,
		readActionError: (key) => snapshot.actionErrors.get(key) ?? null,
		readPendingAction: (key) => snapshot.pendingActions.get(key) ?? null,
		runPendingAction,
		reset: () => {
			resolveExitCompletion();
			snapshot = initialSnapshot;
			nextGeneration = 0;
		},
	};
};
