import { Effect } from "effect";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import type { GraphWorkerRequest, GraphWorkerResponse } from "./GraphWorkerProtocol";

// The worker is the session boundary: all views share this one revision cache.
const graphPromise = Effect.runPromise(createProjectGraphFx());
const requests = new Map<number, AbortController>();
self.onmessage = ({ data }: MessageEvent<GraphWorkerRequest>) => {
	if (data.kind === "cancel") {
		requests.get(data.requestId)?.abort();
		return;
	}
	const controller = new AbortController();
	requests.set(data.requestId, controller);
	void graphPromise
		.then((graph) =>
			Effect.runPromise(graph.queryFx(data.project, data.query), {
				signal: controller.signal,
			}),
		)
		.then((result) => {
			if (!controller.signal.aborted)
				self.postMessage({
					requestId: data.requestId,
					status: "success",
					result,
				} satisfies GraphWorkerResponse);
		})
		.catch((cause: unknown) => {
			if (!controller.signal.aborted)
				self.postMessage({
					requestId: data.requestId,
					status: "error",
					message: cause instanceof Error ? cause.message : String(cause),
				} satisfies GraphWorkerResponse);
		})
		.finally(() => requests.delete(data.requestId));
};
