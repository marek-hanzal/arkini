import { Data, Effect } from "effect";
import ELK from "elkjs/lib/elk-api.js";
import ElkWorker from "elkjs/lib/elk-worker.min.js?worker";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/readEditorItemOriginFlow";
import {
	type EditorItemOriginFlowLayout,
	type EditorItemOriginFlowLayoutInput,
	layoutEditorItemOriginFlow,
} from "~/ui/item/editor/layoutEditorItemOriginFlow";

export class EditorItemOriginFlowLayoutWorkerError extends Data.TaggedError(
	"EditorItemOriginFlowLayoutWorkerError",
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

type RunLayout = (
	topology: EditorItemOriginFlowLayoutInput,
	worker: Worker,
) => Promise<EditorItemOriginFlowLayout>;

const defaultRunLayout: RunLayout = (topology, worker) => {
	const elk = new ELK({
		workerFactory: () => worker,
	});
	return layoutEditorItemOriginFlow(topology, (graph) => elk.layout(graph));
};

/** Computes one layout in a dedicated ELK worker and terminates it on every exit path. */
export const layoutEditorItemOriginFlowInWorkerFx = Effect.fn(
	"layoutEditorItemOriginFlowInWorkerFx",
)(function* (
	flow: EditorItemOriginFlow,
	options: {
		readonly runLayout?: RunLayout;
		readonly spawn?: () => Worker;
	} = {},
) {
	const worker = yield* Effect.acquireRelease(
		Effect.try({
			try: options.spawn ?? (() => new ElkWorker()),
			catch: (cause) =>
				new EditorItemOriginFlowLayoutWorkerError({
					cause,
					message: "Could not start the flow layout worker.",
				}),
		}),
		(worker) => Effect.sync(() => worker.terminate()),
	);
	const topology: EditorItemOriginFlowLayoutInput = {
		edges: flow.edges.map(({ id, source, target }) => ({
			id,
			source,
			target,
		})),
		nodes: flow.nodes.map(({ id, kind }) => ({
			id,
			kind,
		})),
	};

	return yield* Effect.tryPromise({
		try: () => (options.runLayout ?? defaultRunLayout)(topology, worker),
		catch: (cause) =>
			new EditorItemOriginFlowLayoutWorkerError({
				cause,
				message: cause instanceof Error ? cause.message : String(cause),
			}),
	});
});
