import { Data, Effect } from "effect";

import type { ItemOriginFlow } from "~/flow/type/ItemOriginFlow";
import LayoutWorker from "~/flow-layout/worker/layout.worker.ts?worker";
import type { Layout, LayoutInput } from "~/flow-layout/type/Layout";
import type {
	LayoutWorkerRequest,
	LayoutWorkerResponse,
} from "~/flow-layout/type/LayoutWorkerProtocol";
import { readNodeMetricsFn } from "~/flow-layout/fn/readNodeMetricsFn";

class LayoutWorkerError extends Data.TaggedError("LayoutWorkerError")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

type RunLayout = (topology: LayoutInput, worker: Worker) => Promise<Layout>;

const runLayoutFn = (topology: LayoutInput, worker: Worker): Promise<Layout> =>
	new Promise((resolveFn, rejectFn) => {
		const cleanUpFn = () => {
			worker.removeEventListener("message", handleMessageFn);
			worker.removeEventListener("error", handleErrorFn);
		};
		const handleMessageFn = ({ data }: MessageEvent<LayoutWorkerResponse>) => {
			cleanUpFn();
			if (data.status === "success") resolveFn(data.layout);
			else rejectFn(new Error(data.message));
		};
		const handleErrorFn = (event: ErrorEvent) => {
			cleanUpFn();
			rejectFn(event.error ?? new Error(event.message || "Flow layout worker failed."));
		};
		worker.addEventListener("message", handleMessageFn);
		worker.addEventListener("error", handleErrorFn);
		worker.postMessage({
			topology,
		} satisfies LayoutWorkerRequest);
	});

/** Computes one flow layout off the renderer thread and terminates its worker on exit. */
export const layoutInWorkerFx = Effect.fn("layoutInWorkerFx")(
	(
		flow: ItemOriginFlow,
		options: {
			readonly runLayoutFn?: RunLayout;
			readonly spawnFn?: () => Worker;
		} = {},
	) =>
		Effect.gen(function* () {
			const topology = {
				edges: flow.edges.map(({ id, source, sourcePortId, target, targetPortId }) => ({
					id,
					source,
					sourcePortId,
					target,
					targetPortId,
				})),
				nodes: flow.nodes.map((node) => {
					const metrics = readNodeMetricsFn(node);
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
			} satisfies LayoutInput;
			return yield* Effect.acquireUseRelease(
				Effect.try({
					try: options.spawnFn ?? (() => new LayoutWorker()),
					catch: (cause) =>
						new LayoutWorkerError({
							cause,
							message: "Could not start the flow layout worker.",
						}),
				}),
				(worker) =>
					Effect.tryPromise({
						try: () => (options.runLayoutFn ?? runLayoutFn)(topology, worker),
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
