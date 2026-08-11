import { Data, Effect } from "effect";

import type { EditorItemEstimateIndexProgress } from "~/editor/EditorItemEstimateIndex";
import EstimateWorker from "~/ui/item/editor/editorItemEstimate.worker.ts?worker";
import type {
	EditorItemEstimateWorkerRequest,
	EditorItemEstimateWorkerResponse,
	EditorItemEstimateWorkerResult,
} from "~/ui/item/editor/editorItemEstimateWorkerProtocol";

class EditorItemEstimateWorkerError extends Data.TaggedError("EditorItemEstimateWorkerError")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

type RunEstimate = (
	request: EditorItemEstimateWorkerRequest,
	worker: Worker,
	onProgress?: (progress: EditorItemEstimateIndexProgress) => void,
) => Promise<EditorItemEstimateWorkerResult>;

interface RunEditorItemEstimateInWorkerOptions {
	readonly onProgress?: (progress: EditorItemEstimateIndexProgress) => void;
	readonly runEstimate?: RunEstimate;
	readonly spawn?: () => Worker;
}

/** Runs one cancellable estimate request off the renderer thread. */
export const runEditorItemEstimateInWorkerFx = Effect.fn("runEditorItemEstimateInWorkerFx")(
	(
		request: EditorItemEstimateWorkerRequest,
		options: RunEditorItemEstimateInWorkerOptions = {},
	) =>
		Effect.acquireUseRelease(
			Effect.try({
				try: options.spawn ?? (() => new EstimateWorker()),
				catch: (cause) =>
					new EditorItemEstimateWorkerError({
						cause,
						message: "Could not start the estimate worker.",
					}),
			}),
			(worker) =>
				Effect.tryPromise({
					try: () =>
						(
							options.runEstimate ??
							((request, worker, onProgress) =>
								new Promise((resolve, reject) => {
									const cleanUp = () => {
										worker.removeEventListener("message", handleMessage);
										worker.removeEventListener("error", handleError);
									};
									const handleMessage = ({
										data,
									}: MessageEvent<EditorItemEstimateWorkerResponse>) => {
										if (data.status === "progress") {
											onProgress?.(data.progress);
											return;
										}
										cleanUp();
										if (data.status === "success") resolve(data.result);
										else reject(new Error(data.message));
									};
									const handleError = (event: ErrorEvent) => {
										cleanUp();
										reject(
											event.error ??
												new Error(
													event.message || "Estimate worker failed.",
												),
										);
									};
									worker.addEventListener("message", handleMessage);
									worker.addEventListener("error", handleError);
									worker.postMessage(request);
								}))
						)(request, worker, options.onProgress),
					catch: (cause) =>
						new EditorItemEstimateWorkerError({
							cause,
							message: cause instanceof Error ? cause.message : String(cause),
						}),
				}),
			(worker) => Effect.sync(() => worker.terminate()),
		),
);
