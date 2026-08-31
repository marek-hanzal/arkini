import { Cause, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import type { ItemEstimate } from "~/estimate/type/ItemEstimate";
import { runItemEstimateInWorkerFx } from "~/estimate/worker/runItemEstimateInWorkerFx";

export namespace ItemEstimateCacheAtom {
	export interface Snapshot {
		readonly config: EditorProject["config"];
		readonly projectId: string;
		readonly revision: number;
	}

	export interface State {
		readonly estimates: ReadonlyMap<string, ItemEstimate>;
		readonly message?: string;
		readonly snapshot?: Snapshot;
		readonly status: "idle" | "loading" | "ready" | "error";
	}
}

const initialState: ItemEstimateCacheAtom.State = {
	estimates: new Map(),
	status: "idle",
};

const sameSnapshot = (
	left: ItemEstimateCacheAtom.Snapshot | undefined,
	right: ItemEstimateCacheAtom.Snapshot,
) => left?.projectId === right.projectId && left.revision === right.revision;

const readCauseMessage = (cause: Cause.Cause<unknown>) => {
	const error = Cause.findErrorOption(cause);
	return error._tag === "Some" && error.value instanceof Error
		? error.value.message
		: String(Cause.squash(cause));
};

const stateAtom = Atom.make<ItemEstimateCacheAtom.State>(initialState).pipe(Atom.keepAlive);
const runnerAtom = Atom.fn((snapshot: ItemEstimateCacheAtom.Snapshot) =>
	Effect.gen(function* () {
		const exit = yield* Effect.exit(
			runItemEstimateInWorkerFx({
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
						} satisfies ItemEstimateCacheAtom.State)
					: state,
			);
			return;
		}
		if (Cause.hasInterruptsOnly(exit.cause)) return yield* Effect.failCause(exit.cause);
		yield* Atom.update(stateAtom, (state) =>
			sameSnapshot(state.snapshot, snapshot)
				? ({
						estimates: new Map<string, ItemEstimate>(),
						message: readCauseMessage(exit.cause),
						snapshot,
						status: "error",
					} satisfies ItemEstimateCacheAtom.State)
				: state,
		);
	}),
).pipe(Atom.keepAlive);

/** Process-lifetime estimate authority owned and disposed by RendererAtomRegistry. */
export const ItemEstimateCacheAtom = Atom.writable(
	(get) => get(stateAtom),
	(context, snapshot: ItemEstimateCacheAtom.Snapshot) => {
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
