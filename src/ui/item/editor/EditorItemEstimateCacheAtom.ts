import { Cause, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorItemEstimateIndexProgress } from "~/editor/EditorItemEstimateIndex";
import type { EditorItemSimulation } from "~/editor/simulator/EditorItemSimulation";
import {
	EditorItemEstimatePersistence,
	EditorItemEstimatePlannerRevision,
	type EditorItemEstimatePersistenceService,
} from "~/ui/item/editor/EditorItemEstimatePersistence";
import type {
	EditorItemEstimateWorkerRequest,
	EditorItemEstimateWorkerResult,
} from "~/ui/item/editor/editorItemEstimateWorkerProtocol";
import { runEditorItemEstimateInWorkerFx } from "~/ui/item/editor/runEditorItemEstimateInWorkerFx";

export namespace EditorItemEstimateCacheAtom {
	export interface Snapshot {
		readonly config: EditorProject["config"];
		readonly projectId: string;
		readonly revision: number;
	}

	export interface Job {
		readonly itemId: string;
		readonly quantity: number;
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
		readonly errors: ReadonlyMap<string, ReadonlyMap<number, string>>;
		readonly hydrated: boolean;
		readonly progress: EditorItemEstimateIndexProgress;
		readonly snapshot?: Snapshot;
	}

	export interface Options {
		readonly persistence?: EditorItemEstimatePersistenceService;
		readonly runInWorkerFx?: (
			request: EditorItemEstimateWorkerRequest,
		) => Effect.Effect<EditorItemEstimateWorkerResult, unknown>;
	}
}

interface CacheState {
	readonly estimates: ReadonlyMap<string, ReadonlyMap<number, EditorItemSimulation>>;
	readonly errors: ReadonlyMap<string, ReadonlyMap<number, string>>;
	readonly hydrated: boolean;
	readonly indexRequested: boolean;
	readonly queue: ReadonlyArray<EditorItemEstimateCacheAtom.Job>;
	readonly requestedJobs: ReadonlyArray<EditorItemEstimateCacheAtom.Job>;
	readonly runningJob?: EditorItemEstimateCacheAtom.Job;
	readonly snapshot?: EditorItemEstimateCacheAtom.Snapshot;
}

const initialState: CacheState = {
	errors: new Map(),
	estimates: new Map(),
	hydrated: false,
	indexRequested: false,
	queue: [],
	requestedJobs: [],
};

const sameSnapshot = (
	left: EditorItemEstimateCacheAtom.Snapshot | undefined,
	right: EditorItemEstimateCacheAtom.Snapshot,
) => left?.projectId === right.projectId && left.revision === right.revision;

const sameJob = (left: EditorItemEstimateCacheAtom.Job, right: EditorItemEstimateCacheAtom.Job) =>
	left.itemId === right.itemId && left.quantity === right.quantity;

const readEstimate = (state: CacheState, itemId: string, quantity: number) =>
	state.estimates.get(itemId)?.get(quantity);

const readError = (state: CacheState, itemId: string, quantity: number) =>
	state.errors.get(itemId)?.get(quantity);

const addEstimate = (state: CacheState, estimate: EditorItemSimulation): CacheState => {
	const quantities = new Map(state.estimates.get(estimate.itemId));
	quantities.set(estimate.quantity, estimate);
	const estimates = new Map(state.estimates);
	estimates.set(estimate.itemId, quantities);
	return {
		...state,
		estimates,
	};
};

const removeError = (state: CacheState, job: EditorItemEstimateCacheAtom.Job): CacheState => {
	const current = state.errors.get(job.itemId);
	if (current === undefined || !current.has(job.quantity)) return state;
	const quantities = new Map(current);
	quantities.delete(job.quantity);
	const errors = new Map(state.errors);
	if (quantities.size === 0) errors.delete(job.itemId);
	else errors.set(job.itemId, quantities);
	return {
		...state,
		errors,
	};
};

const addError = (
	state: CacheState,
	job: EditorItemEstimateCacheAtom.Job,
	message: string,
): CacheState => {
	const quantities = new Map(state.errors.get(job.itemId));
	quantities.set(job.quantity, message);
	const errors = new Map(state.errors);
	errors.set(job.itemId, quantities);
	return {
		...state,
		errors,
	};
};

const dedupeJobs = (jobs: ReadonlyArray<EditorItemEstimateCacheAtom.Job>) => {
	const result: EditorItemEstimateCacheAtom.Job[] = [];
	for (const job of jobs)
		if (!result.some((candidate) => sameJob(candidate, job))) result.push(job);
	return result;
};

const countSettledIndexItems = (state: CacheState) => {
	const itemIds = Object.keys(state.snapshot?.config.items ?? {});
	return itemIds.filter(
		(itemId) =>
			readEstimate(state, itemId, 1) !== undefined ||
			readError(state, itemId, 1) !== undefined,
	).length;
};

const readPublicState = (state: CacheState): EditorItemEstimateCacheAtom.State => ({
	errors: state.errors,
	estimates: state.estimates,
	hydrated: state.hydrated,
	progress: {
		completed: countSettledIndexItems(state),
		total: Object.keys(state.snapshot?.config.items ?? {}).length,
	},
	snapshot: state.snapshot,
});

const persistenceSnapshot = (snapshot: EditorItemEstimateCacheAtom.Snapshot) => ({
	plannerRevision: EditorItemEstimatePlannerRevision,
	projectId: snapshot.projectId,
	revision: snapshot.revision,
});

const readCauseMessage = (cause: Cause.Cause<unknown>) => {
	const error = Cause.findErrorOption(cause);
	return error._tag === "Some" && error.value instanceof Error
		? error.value.message
		: String(Cause.squash(cause));
};

const requestedQueue = (state: CacheState) => {
	if (state.snapshot === undefined) return [];
	const indexJobs = state.indexRequested
		? Object.keys(state.snapshot.config.items)
				.sort((left, right) => left.localeCompare(right))
				.map((itemId) => ({
					itemId,
					quantity: 1,
				}))
		: [];
	return dedupeJobs([
		...state.requestedJobs,
		...indexJobs,
	]).filter(
		(job) =>
			readEstimate(state, job.itemId, job.quantity) === undefined &&
			readError(state, job.itemId, job.quantity) === undefined &&
			!sameJob(
				state.runningJob ?? {
					itemId: "",
					quantity: -1,
				},
				job,
			),
	);
};

/**
 * Creates one renderer-registry-owned authority for authoritative engine-backed item estimates.
 * The authority survives route unmounts, hydrates terminal results from persistent storage, and
 * keeps one background queue for both detail requests and the global all-item list.
 */
export const makeEditorItemEstimateCacheAtom = (
	options: EditorItemEstimateCacheAtom.Options = {},
) => {
	const persistence = options.persistence ?? EditorItemEstimatePersistence;
	const runInWorkerFx = options.runInWorkerFx ?? runEditorItemEstimateInWorkerFx;
	const stateAtom = Atom.make(initialState).pipe(Atom.keepAlive);

	const queueRunnerAtom = Atom.fn((snapshot: EditorItemEstimateCacheAtom.Snapshot) =>
		Effect.gen(function* () {
			while (true) {
				const state = yield* Atom.get(stateAtom);
				if (!sameSnapshot(state.snapshot, snapshot)) return;
				const next = state.queue[0];
				if (next === undefined) return;
				yield* Atom.update(stateAtom, (current) =>
					sameSnapshot(current.snapshot, snapshot)
						? {
								...current,
								queue: current.queue.filter((job) => !sameJob(job, next)),
								runningJob: next,
							}
						: current,
				);
				const result = yield* Effect.exit(
					runInWorkerFx({
						config: snapshot.config,
						itemId: next.itemId,
						quantity: next.quantity,
						type: "item",
					}),
				);
				if (result._tag === "Success") {
					if (result.value.type !== "item")
						return yield* Effect.die(
							new Error("Estimate worker returned a non-item result."),
						);
					const estimate = result.value.estimate;
					yield* persistence
						.writeEstimateFx(persistenceSnapshot(snapshot), estimate)
						.pipe(Effect.ignore);
					yield* Atom.update(stateAtom, (current) => {
						if (!sameSnapshot(current.snapshot, snapshot)) return current;
						const withEstimate = removeError(addEstimate(current, estimate), next);
						return {
							...withEstimate,
							runningJob: undefined,
						};
					});
				} else if (!Cause.hasInterruptsOnly(result.cause)) {
					yield* Atom.update(stateAtom, (current) => {
						if (!sameSnapshot(current.snapshot, snapshot)) return current;
						return {
							...addError(current, next, readCauseMessage(result.cause)),
							runningJob: undefined,
						};
					});
				} else return yield* Effect.failCause(result.cause);
				const current = yield* Atom.get(stateAtom);
				if (!sameSnapshot(current.snapshot, snapshot)) return;
				const replenished = requestedQueue(current);
				yield* Atom.update(stateAtom, (latest) =>
					sameSnapshot(latest.snapshot, snapshot)
						? {
								...latest,
								queue: dedupeJobs([
									...latest.queue,
									...replenished,
								]),
							}
						: latest,
				);
			}
		}),
	).pipe(Atom.keepAlive);

	const hydrateRunnerAtom = Atom.fn((snapshot: EditorItemEstimateCacheAtom.Snapshot, get) =>
		Effect.gen(function* () {
			const persistedSnapshot = persistenceSnapshot(snapshot);
			yield* persistence.pruneProjectFx(persistedSnapshot);
			const persisted = yield* persistence.readSnapshotFx(persistedSnapshot);
			yield* Atom.update(stateAtom, (current) => {
				if (!sameSnapshot(current.snapshot, snapshot)) return current;
				let next = current;
				for (const estimate of persisted) {
					if (snapshot.config.items[estimate.itemId] === undefined) continue;
					next = addEstimate(next, estimate);
				}
				next = {
					...next,
					hydrated: true,
				};
				return {
					...next,
					queue: requestedQueue(next),
				};
			});
			const current = yield* Atom.get(stateAtom);
			if (sameSnapshot(current.snapshot, snapshot) && current.queue.length > 0)
				get.set(queueRunnerAtom, snapshot);
		}),
	).pipe(Atom.keepAlive);

	const ensureRunner = (
		context: Parameters<Parameters<typeof Atom.writable>[1]>[0],
		snapshot: EditorItemEstimateCacheAtom.Snapshot,
		state: CacheState,
	) => {
		if (!state.hydrated || state.queue.length === 0 || context.get(queueRunnerAtom).waiting)
			return;
		context.set(queueRunnerAtom, snapshot);
	};

	return Atom.writable(
		(get) => readPublicState(get(stateAtom)),
		(context, request: EditorItemEstimateCacheAtom.Request) => {
			let state = context.get(stateAtom);
			const needsHydration = !sameSnapshot(state.snapshot, request.snapshot);
			if (needsHydration) {
				context.set(queueRunnerAtom, Atom.Interrupt);
				context.set(hydrateRunnerAtom, Atom.Interrupt);
				state = {
					...initialState,
					snapshot: request.snapshot,
				};
			}

			if (request.type === "index") {
				state = {
					...state,
					indexRequested: true,
				};
			} else {
				const requested = {
					itemId: request.itemId,
					quantity: request.quantity,
				};
				const requestedJobs = dedupeJobs([
					requested,
					...state.requestedJobs,
				]);
				const errors = removeError(
					{
						...state,
						requestedJobs,
					},
					requested,
				).errors;
				const queue = state.hydrated
					? dedupeJobs([
							...(readEstimate(state, requested.itemId, requested.quantity) ===
								undefined &&
							!sameJob(
								state.runningJob ?? {
									itemId: "",
									quantity: -1,
								},
								requested,
							)
								? [
										requested,
									]
								: []),
							...state.queue.filter((job) => !sameJob(job, requested)),
						])
					: state.queue;
				state = {
					...state,
					errors,
					queue,
					requestedJobs,
				};
			}

			if (state.hydrated) {
				const missing = requestedQueue(state);
				state = {
					...state,
					queue: dedupeJobs([
						...state.queue,
						...missing,
					]),
				};
			}
			context.set(stateAtom, state);
			if (needsHydration) context.set(hydrateRunnerAtom, request.snapshot);
			else ensureRunner(context as never, request.snapshot, state);
		},
	).pipe(Atom.keepAlive);
};

/** Process-lifetime estimate authority owned and disposed by RendererAtomRegistry. */
export const EditorItemEstimateCacheAtom = makeEditorItemEstimateCacheAtom();
