import { Cause, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type {
	EditorItemEstimateIndexEntry,
	EditorItemEstimateIndexProgress,
} from "~/editor/EditorItemEstimateIndex";
import type { EditorItemSimulation } from "~/editor/simulator/EditorItemSimulation";
import type {
	EditorItemEstimateWorkerRequest,
	EditorItemEstimateWorkerResult,
} from "~/ui/item/editor/editorItemEstimateWorkerProtocol";
import { runEditorItemEstimateIndexPoolFx } from "~/ui/item/editor/runEditorItemEstimateIndexPoolFx";
import { runEditorItemEstimateInWorkerFx } from "~/ui/item/editor/runEditorItemEstimateInWorkerFx";

export namespace EditorItemEstimateCacheAtom {
	export interface Snapshot {
		readonly config: EditorProject["config"];
		readonly projectId: string;
		readonly revision: number;
	}

	export type Request =
		| {
				readonly snapshot: Snapshot;
				readonly type: "index";
		  }
		| {
				readonly itemId: string;
				readonly quantity: number;
				readonly snapshot: Snapshot;
				readonly type: "item";
		  };

	export interface State {
		readonly estimates: ReadonlyMap<string, ReadonlyMap<number, EditorItemSimulation>>;
		readonly indexEntries?: ReadonlyArray<EditorItemEstimateIndexEntry>;
		readonly indexError?: string;
		readonly indexPending: boolean;
		readonly indexQueued: boolean;
		readonly itemError?: {
			readonly itemId: string;
			readonly message: string;
			readonly quantity: number;
		};
		readonly itemPending?: {
			readonly itemId: string;
			readonly quantity: number;
		};
		readonly itemRequested?: {
			readonly itemId: string;
			readonly quantity: number;
		};
		readonly progress: EditorItemEstimateIndexProgress;
		readonly snapshot?: Snapshot;
	}

	export interface Options {
		readonly runIndexPoolFx?: (
			config: EditorProject["config"],
			options?: {
				readonly cachedEstimates?: ReadonlyArray<EditorItemSimulation>;
				readonly onEstimate?: (estimate: EditorItemSimulation) => void;
				readonly onProgress?: (progress: EditorItemEstimateIndexProgress) => void;
			},
		) => Effect.Effect<ReadonlyArray<EditorItemEstimateIndexEntry>, unknown>;
		readonly runInWorkerFx?: (
			request: EditorItemEstimateWorkerRequest,
			options?: {
				readonly onEstimate?: (estimate: EditorItemSimulation) => void;
				readonly onProgress?: (progress: EditorItemEstimateIndexProgress) => void;
			},
		) => Effect.Effect<EditorItemEstimateWorkerResult, unknown>;
	}
}

const initialState: EditorItemEstimateCacheAtom.State = {
	estimates: new Map(),
	indexPending: false,
	indexQueued: false,
	progress: {
		completed: 0,
		itemId: "",
		total: 0,
	},
};

const sameSnapshot = (
	left: EditorItemEstimateCacheAtom.Snapshot | undefined,
	right: EditorItemEstimateCacheAtom.Snapshot,
) => left?.projectId === right.projectId && left.revision === right.revision;

const readEstimate = (state: EditorItemEstimateCacheAtom.State, itemId: string, quantity: number) =>
	state.estimates.get(itemId)?.get(quantity);

const addEstimate = (
	state: EditorItemEstimateCacheAtom.State,
	estimate: EditorItemSimulation,
): EditorItemEstimateCacheAtom.State => {
	const quantities = new Map(state.estimates.get(estimate.itemId));
	quantities.set(estimate.quantity, estimate);
	const estimates = new Map(state.estimates);
	estimates.set(estimate.itemId, quantities);
	return {
		...state,
		estimates,
	};
};

const readCauseMessage = (cause: Cause.Cause<unknown>) => {
	const error = Cause.findErrorOption(cause);
	return error._tag === "Some" && error.value instanceof Error
		? error.value.message
		: String(Cause.squash(cause));
};

/**
 * Creates one renderer-registry-owned cache authority for editor estimates.
 * Production exports exactly one keep-alive instance below; the factory keeps tests isolated.
 */
export const makeEditorItemEstimateCacheAtom = (
	options: EditorItemEstimateCacheAtom.Options = {},
) => {
	const runInWorkerFx = options.runInWorkerFx ?? runEditorItemEstimateInWorkerFx;
	const runIndexPoolFx = options.runIndexPoolFx ?? runEditorItemEstimateIndexPoolFx;
	const stateAtom = Atom.make(initialState).pipe(Atom.keepAlive);

	const itemRunnerAtom = Atom.fn(
		(
			request: Extract<
				EditorItemEstimateCacheAtom.Request,
				{
					readonly type: "item";
				}
			>,
			get,
		) => {
			const continueQueuedIndexFx = Effect.gen(function* () {
				const state = yield* Atom.get(stateAtom);
				if (!sameSnapshot(state.snapshot, request.snapshot) || !state.indexQueued) return;
				yield* Atom.update(stateAtom, (current) => ({
					...current,
					indexPending: true,
					indexQueued: false,
				}));
				get.set(indexRunnerAtom, {
					snapshot: request.snapshot,
					type: "index",
				});
			});
			return Effect.matchCauseEffect(
				runInWorkerFx({
					config: request.snapshot.config,
					itemId: request.itemId,
					quantity: request.quantity,
					type: "item",
				}),
				{
					onFailure: (cause) =>
						Cause.hasInterruptsOnly(cause)
							? Effect.failCause(cause)
							: Effect.gen(function* () {
									yield* Atom.update(stateAtom, (state) =>
										sameSnapshot(state.snapshot, request.snapshot)
											? {
													...state,
													itemError: {
														itemId: request.itemId,
														message: readCauseMessage(cause),
														quantity: request.quantity,
													},
													itemPending: undefined,
												}
											: state,
									);
									yield* continueQueuedIndexFx;
								}),
					onSuccess: (result) =>
						result.type === "item"
							? Effect.gen(function* () {
									yield* Atom.update(stateAtom, (state) =>
										sameSnapshot(state.snapshot, request.snapshot)
											? {
													...addEstimate(state, result.estimate),
													itemError: undefined,
													itemPending: undefined,
												}
											: state,
									);
									yield* continueQueuedIndexFx;
								})
							: Effect.die(
									new Error("Estimate item worker returned an index result."),
								),
				},
			);
		},
	).pipe(Atom.keepAlive);

	const indexRunnerAtom = Atom.fn(
		(
			request: Extract<
				EditorItemEstimateCacheAtom.Request,
				{
					readonly type: "index";
				}
			>,
			get,
		) => {
			const state = get(stateAtom);
			const cachedEstimates = [
				...state.estimates.values(),
			].flatMap((quantities) => {
				const estimate = quantities.get(1);
				return estimate === undefined
					? []
					: [
							estimate,
						];
			});
			return Effect.matchCauseEffect(
				runIndexPoolFx(request.snapshot.config, {
					cachedEstimates,
					onEstimate: (estimate) => {
						const current = get(stateAtom);
						if (sameSnapshot(current.snapshot, request.snapshot))
							get.set(stateAtom, addEstimate(current, estimate));
					},
					onProgress: (progress) => {
						const current = get(stateAtom);
						if (sameSnapshot(current.snapshot, request.snapshot))
							get.set(stateAtom, {
								...current,
								progress,
							});
					},
				}),
				{
					onFailure: (cause) =>
						Cause.hasInterruptsOnly(cause)
							? Effect.failCause(cause)
							: Effect.gen(function* () {
									yield* Atom.update(stateAtom, (current) =>
										sameSnapshot(current.snapshot, request.snapshot)
											? {
													...current,
													indexError: readCauseMessage(cause),
													indexPending: false,
												}
											: current,
									);
									const current = yield* Atom.get(stateAtom);
									const requested = current.itemRequested;
									if (
										requested === undefined ||
										readEstimate(
											current,
											requested.itemId,
											requested.quantity,
										) !== undefined
									)
										return;
									yield* Atom.update(stateAtom, (state) => ({
										...state,
										itemPending: requested,
									}));
									get.set(itemRunnerAtom, {
										...requested,
										snapshot: request.snapshot,
										type: "item",
									});
								}),
					onSuccess: (result) =>
						Effect.gen(function* () {
							yield* Atom.update(stateAtom, (current) =>
								sameSnapshot(current.snapshot, request.snapshot)
									? {
											...current,
											indexEntries: result,
											indexError: undefined,
											indexPending: false,
										}
									: current,
							);
							const current = yield* Atom.get(stateAtom);
							const requested = current.itemRequested;
							if (
								requested === undefined ||
								readEstimate(current, requested.itemId, requested.quantity) !==
									undefined
							)
								return;
							yield* Atom.update(stateAtom, (state) => ({
								...state,
								itemPending: requested,
							}));
							get.set(itemRunnerAtom, {
								...requested,
								snapshot: request.snapshot,
								type: "item",
							});
						}),
				},
			);
		},
	).pipe(Atom.keepAlive);

	return Atom.writable(
		(get) => get(stateAtom),
		(context, request: EditorItemEstimateCacheAtom.Request) => {
			let state = context.get(stateAtom);
			if (!sameSnapshot(state.snapshot, request.snapshot)) {
				context.set(itemRunnerAtom, Atom.Interrupt);
				context.set(indexRunnerAtom, Atom.Interrupt);
				state = {
					...initialState,
					progress: {
						...initialState.progress,
						total: Object.keys(request.snapshot.config.items).length,
					},
					snapshot: request.snapshot,
				};
				context.set(stateAtom, state);
			}

			if (request.type === "index") {
				if (state.indexEntries !== undefined || state.indexPending || state.indexQueued)
					return;
				if (state.itemPending !== undefined) {
					context.set(stateAtom, {
						...state,
						indexQueued: true,
					});
					return;
				}
				context.set(stateAtom, {
					...state,
					indexError: undefined,
					indexPending: true,
				});
				context.set(indexRunnerAtom, request);
				return;
			}

			const requested = {
				itemId: request.itemId,
				quantity: request.quantity,
			};
			if (readEstimate(state, request.itemId, request.quantity) !== undefined) {
				context.set(stateAtom, {
					...state,
					itemRequested: requested,
				});
				return;
			}
			if (state.indexPending) {
				context.set(stateAtom, {
					...state,
					itemRequested: requested,
				});
				return;
			}
			if (
				state.itemPending?.itemId === request.itemId &&
				state.itemPending.quantity === request.quantity
			)
				return;
			context.set(stateAtom, {
				...state,
				itemError: undefined,
				itemPending: requested,
				itemRequested: requested,
			});
			context.set(itemRunnerAtom, request);
		},
	).pipe(Atom.keepAlive);
};

/** Process-lifetime estimate cache owned and disposed by RendererAtomRegistry. */
export const EditorItemEstimateCacheAtom = makeEditorItemEstimateCacheAtom();
