import { Data, Effect } from "effect";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/readEditorItemOriginFlowFx";
import LayoutWorker from "~/ui/item/editor/editorItemOriginFlowLayout.worker.ts?worker";
import type {
	EditorItemOriginFlowLayout,
	EditorItemOriginFlowLayoutInput,
} from "~/ui/item/editor/editorItemOriginFlowLayout";
import type {
	EditorItemOriginFlowLayoutWorkerRequest,
	EditorItemOriginFlowLayoutWorkerResponse,
} from "~/ui/item/editor/editorItemOriginFlowLayoutWorkerProtocol";
import { readEditorOriginFlowNodeMetricsFx } from "~/ui/item/editor/readEditorOriginFlowNodeMetricsFx";

class EditorItemOriginFlowLayoutWorkerError extends Data.TaggedError(
	"EditorItemOriginFlowLayoutWorkerError",
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

type RunLayout = (
	topology: EditorItemOriginFlowLayoutInput,
	worker: Worker,
) => Promise<EditorItemOriginFlowLayout>;

const runLayout = (
	topology: EditorItemOriginFlowLayoutInput,
	worker: Worker,
): Promise<EditorItemOriginFlowLayout> =>
	new Promise((resolve, reject) => {
		const cleanUp = () => {
			worker.removeEventListener("message", handleMessage);
			worker.removeEventListener("error", handleError);
		};
		const handleMessage = ({
			data,
		}: MessageEvent<EditorItemOriginFlowLayoutWorkerResponse>) => {
			cleanUp();
			if (data.status === "success") resolve(data.layout);
			else reject(new Error(data.message));
		};
		const handleError = (event: ErrorEvent) => {
			cleanUp();
			reject(event.error ?? new Error(event.message || "Flow layout worker failed."));
		};
		worker.addEventListener("message", handleMessage);
		worker.addEventListener("error", handleError);
		worker.postMessage({
			topology,
		} satisfies EditorItemOriginFlowLayoutWorkerRequest);
	});

const readTopologyFx = (flow: EditorItemOriginFlow) =>
	Effect.gen(function* () {
		const nodes = yield* Effect.forEach(flow.nodes, (node) =>
			Effect.gen(function* () {
				const metrics = yield* readEditorOriginFlowNodeMetricsFx(node);
				return {
					height: metrics.height,
					id: node.id,
					ports: [
						...metrics.portOffsets,
					].map(([id, offset]) => ({
						id,
						x: offset.x,
						y: offset.y,
					})),
					type: node.type,
					width: metrics.width,
				};
			}),
		);
		return {
			edges: flow.edges.map(({ id, source, sourcePortId, target, targetPortId }) => ({
				id,
				source,
				sourcePortId,
				target,
				targetPortId,
			})),
			nodes,
		} satisfies EditorItemOriginFlowLayoutInput;
	});

/** Computes one flow layout off the renderer thread and terminates its worker on exit. */
export const layoutEditorItemOriginFlowInWorkerFx = Effect.fn(
	"layoutEditorItemOriginFlowInWorkerFx",
)(
	(
		flow: EditorItemOriginFlow,
		options: {
			readonly runLayout?: RunLayout;
			readonly spawn?: () => Worker;
		} = {},
	) =>
		Effect.gen(function* () {
			const topology = yield* readTopologyFx(flow);
			return yield* Effect.acquireUseRelease(
				Effect.try({
					try: options.spawn ?? (() => new LayoutWorker()),
					catch: (cause) =>
						new EditorItemOriginFlowLayoutWorkerError({
							cause,
							message: "Could not start the flow layout worker.",
						}),
				}),
				(worker) =>
					Effect.tryPromise({
						try: () => (options.runLayout ?? runLayout)(topology, worker),
						catch: (cause) =>
							new EditorItemOriginFlowLayoutWorkerError({
								cause,
								message: cause instanceof Error ? cause.message : String(cause),
							}),
					}),
				(worker) => Effect.sync(() => worker.terminate()),
			);
		}),
);
