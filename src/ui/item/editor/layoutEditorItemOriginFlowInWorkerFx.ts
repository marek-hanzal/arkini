import { Data, Effect } from "effect";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/readEditorItemOriginFlow";
import LayoutWorker from "~/ui/item/editor/editorItemOriginFlowLayout.worker.ts?worker";
import type {
	EditorItemOriginFlowLayout,
	EditorItemOriginFlowLayoutInput,
} from "~/ui/item/editor/layoutEditorItemOriginFlowFx";
import { readEditorOriginFlowNodeMetrics } from "~/ui/item/editor/readEditorOriginFlowNodeMetrics";

class EditorItemOriginFlowLayoutWorkerError extends Data.TaggedError(
	"EditorItemOriginFlowLayoutWorkerError",
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

type LayoutWorkerResponse =
	| {
			readonly layout: EditorItemOriginFlowLayout;
			readonly status: "success";
	  }
	| {
			readonly message: string;
			readonly status: "error";
	  };

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
		const handleMessage = ({ data }: MessageEvent<LayoutWorkerResponse>) => {
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
		});
	});

const readTopology = (flow: EditorItemOriginFlow): EditorItemOriginFlowLayoutInput => ({
	edges: flow.edges.map(({ id, source, sourcePortId, target, targetPortId }) => ({
		id,
		source,
		sourcePortId,
		target,
		targetPortId,
	})),
	nodes: flow.nodes.map((node) => {
		const metrics = readEditorOriginFlowNodeMetrics(node);
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
			width: metrics.width,
		};
	}),
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
		Effect.acquireUseRelease(
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
					try: () => (options.runLayout ?? runLayout)(readTopology(flow), worker),
					catch: (cause) =>
						new EditorItemOriginFlowLayoutWorkerError({
							cause,
							message: cause instanceof Error ? cause.message : String(cause),
						}),
				}),
			(worker) => Effect.sync(() => worker.terminate()),
		),
);
