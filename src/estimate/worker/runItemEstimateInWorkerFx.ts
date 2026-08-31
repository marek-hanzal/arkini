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
	readonly runEstimateFn?: RunEstimate;
	readonly spawnFn?: () => Worker;
}

/** Runs one cancellable estimate request off the renderer thread. */
export const runItemEstimateInWorkerFx = Effect.fn("runEditorItemEstimateInWorkerFx")(
	(request: ItemEstimateWorkerRequest, options: RunItemEstimateInWorkerOptions = {}) =>
		Effect.acquireUseRelease(
			Effect.try({
				try: options.spawnFn ?? (() => new EstimateWorker()),
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
							options.runEstimateFn ??
							((request, worker) =>
								new Promise((resolveFn, rejectFn) => {
									const cleanUpFn = () => {
										worker.removeEventListener("message", handleMessageFn);
										worker.removeEventListener("error", handleErrorFn);
									};
									const handleMessageFn = ({
										data,
									}: MessageEvent<ItemEstimateWorkerResponse>) => {
										cleanUpFn();
										if (data.status === "success") resolveFn(data.result);
										else rejectFn(new Error(data.message));
									};
									const handleErrorFn = (event: ErrorEvent) => {
										cleanUpFn();
										rejectFn(
											event.error ??
												new Error(
													event.message || "Estimate worker failed.",
												),
										);
									};
									worker.addEventListener("message", handleMessageFn);
									worker.addEventListener("error", handleErrorFn);
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
