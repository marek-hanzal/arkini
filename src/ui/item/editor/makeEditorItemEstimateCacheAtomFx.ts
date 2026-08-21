import { Cause, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorItemEstimate } from "~/editor/estimator/EditorItemEstimate";
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

	export interface State {
		readonly estimates: ReadonlyMap<string, EditorItemEstimate>;
		readonly message?: string;
		readonly snapshot?: Snapshot;
		readonly status: "idle" | "loading" | "ready" | "error";
	}

	export interface Options {
		readonly runInWorkerFx?: (
			request: EditorItemEstimateWorkerRequest,
		) => Effect.Effect<EditorItemEstimateWorkerResult, unknown>;
	}
}

const initialState: EditorItemEstimateCacheAtom.State = {
	estimates: new Map(),
	status: "idle",
};

const sameSnapshot = (
	left: EditorItemEstimateCacheAtom.Snapshot | undefined,
	right: EditorItemEstimateCacheAtom.Snapshot,
) => left?.projectId === right.projectId && left.revision === right.revision;

const readCauseMessage = (cause: Cause.Cause<unknown>) => {
	const error = Cause.findErrorOption(cause);
	return error._tag === "Some" && error.value instanceof Error
		? error.value.message
		: String(Cause.squash(cause));
};

/** Creates the renderer-owned, in-memory estimate batch for the current project snapshot. */
const makeEditorItemEstimateCacheAtom = (options: EditorItemEstimateCacheAtom.Options = {}) => {
	const runInWorkerFx = options.runInWorkerFx ?? runEditorItemEstimateInWorkerFx;
	const stateAtom = Atom.make<EditorItemEstimateCacheAtom.State>(initialState).pipe(
		Atom.keepAlive,
	);
	const runnerAtom = Atom.fn((snapshot: EditorItemEstimateCacheAtom.Snapshot) =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(
				runInWorkerFx({
					config: snapshot.config,
				}),
			);
			if (exit._tag === "Success") {
				yield* Atom.update(stateAtom, (state) =>
					sameSnapshot(state.snapshot, snapshot)
						? ({
								estimates: new Map(
									exit.value.estimates.map((estimate) => [
										estimate.factId,
										estimate,
									]),
								),
								snapshot,
								status: "ready",
							} satisfies EditorItemEstimateCacheAtom.State)
						: state,
				);
				return;
			}
			if (Cause.hasInterruptsOnly(exit.cause)) return yield* Effect.failCause(exit.cause);
			yield* Atom.update(stateAtom, (state) =>
				sameSnapshot(state.snapshot, snapshot)
					? ({
							estimates: new Map<string, EditorItemEstimate>(),
							message: readCauseMessage(exit.cause),
							snapshot,
							status: "error",
						} satisfies EditorItemEstimateCacheAtom.State)
					: state,
			);
		}),
	).pipe(Atom.keepAlive);

	return Atom.writable(
		(get) => get(stateAtom),
		(context, snapshot: EditorItemEstimateCacheAtom.Snapshot) => {
			const state = context.get(stateAtom);
			if (
				sameSnapshot(state.snapshot, snapshot) &&
				(state.status === "loading" || state.status === "ready")
			)
				return;
			context.set(runnerAtom, Atom.Interrupt);
			context.set(stateAtom, {
				estimates: new Map(),
				snapshot,
				status: "loading",
			});
			context.set(runnerAtom, snapshot);
		},
	).pipe(Atom.keepAlive);
};

/** Creates an isolated renderer-owned estimate batch for tests or alternate owners. */
export const makeEditorItemEstimateCacheAtomFx = Effect.fnUntraced(function* (
	options: EditorItemEstimateCacheAtom.Options = {},
) {
	return makeEditorItemEstimateCacheAtom(options);
});

/** Process-lifetime estimate authority owned and disposed by RendererAtomRegistry. */
export const EditorItemEstimateCacheAtom = makeEditorItemEstimateCacheAtom();
