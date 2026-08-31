import { Data, Effect } from "effect";

import EstimateWorker from "~/estimate/worker/itemEstimate.worker.ts?worker";
import type {
	ItemEstimateWorkerRequest,
	ItemEstimateWorkerResponse,
	ItemEstimateWorkerResult,
} from "~/estimate/worker/itemEstimateWorkerProtocol";

class ItemEstimateWorkerError extends Data.TaggedError("EditorItemEstimateWorkerError")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

type RunEstimate = (
	request: ItemEstimateWorkerRequest,
	worker: Worker,
) => Promise<ItemEstimateWorkerResult>;

interface RunItemEstimateInWorkerOptions {
	readonly runEstimate?: RunEstimate;
	readonly spawn?: () => Worker;
}

/** Runs one cancellable estimate request off the renderer thread. */
export const runItemEstimateInWorkerFx = Effect.fn("runEditorItemEstimateInWorkerFx")(
	(request: ItemEstimateWorkerRequest, options: RunItemEstimateInWorkerOptions = {}) =>
		Effect.acquireUseRelease(
			Effect.try({
				try: options.spawn ?? (() => new EstimateWorker()),
				catch: (cause) =>
					new ItemEstimateWorkerError({
						cause,
						message: "Could not start the estimate worker.",
					}),
			}),
			(worker) =>
				Effect.tryPromise({
					try: () =>
						(
							options.runEstimate ??
							((request, worker) =>
								new Promise((resolve, reject) => {
									const cleanUp = () => {
										worker.removeEventListener("message", handleMessage);
										worker.removeEventListener("error", handleError);
									};
									const handleMessage = ({
										data,
									}: MessageEvent<ItemEstimateWorkerResponse>) => {
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
						)(request, worker),
					catch: (cause) =>
						new ItemEstimateWorkerError({
							cause,
							message: cause instanceof Error ? cause.message : String(cause),
						}),
				}),
			(worker) => Effect.sync(() => worker.terminate()),
		),
);
