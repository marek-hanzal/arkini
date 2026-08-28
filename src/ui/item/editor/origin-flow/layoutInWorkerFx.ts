import { Data, Effect } from "effect";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/EditorItemOriginFlow";
import LayoutWorker from "~/ui/item/editor/origin-flow/layout.worker.ts?worker";
import type { Layout, LayoutInput } from "~/ui/item/editor/origin-flow/Layout";
import type {
	LayoutWorkerRequest,
	LayoutWorkerResponse,
} from "~/ui/item/editor/origin-flow/LayoutWorkerProtocol";
import { readNodeMetricsFx } from "~/ui/item/editor/origin-flow/readNodeMetricsFx";

class LayoutWorkerError extends Data.TaggedError("LayoutWorkerError")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

type RunLayout = (topology: LayoutInput, worker: Worker) => Promise<Layout>;

const runLayout = (topology: LayoutInput, worker: Worker): Promise<Layout> =>
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
		} satisfies LayoutWorkerRequest);
	});

const readTopologyFx = (flow: EditorItemOriginFlow) =>
	Effect.gen(function* () {
		const nodes = yield* Effect.forEach(flow.nodes, (node) =>
			Effect.gen(function* () {
				const metrics = yield* readNodeMetricsFx(node);
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
		} satisfies LayoutInput;
	});

/** Computes one flow layout off the renderer thread and terminates its worker on exit. */
export const layoutInWorkerFx = Effect.fn("layoutInWorkerFx")(
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
						new LayoutWorkerError({
							cause,
							message: "Could not start the flow layout worker.",
						}),
				}),
				(worker) =>
					Effect.tryPromise({
						try: () => (options.runLayout ?? runLayout)(topology, worker),
						catch: (cause) =>
							new LayoutWorkerError({
								cause,
								message: cause instanceof Error ? cause.message : String(cause),
							}),
					}),
				(worker) => Effect.sync(() => worker.terminate()),
			);
		}),
);
