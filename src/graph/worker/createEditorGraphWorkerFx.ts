import { Effect } from "effect";
import ProjectGraphWorker from "~/graph/worker/projectGraph.worker.ts?worker";
import { GraphWorkerError } from "~/graph/error/GraphWorkerError";
import type { GraphResult } from "~/graph/type/GraphResult";
import type { GraphQuerySchema } from "~/graph/schema/GraphQuerySchema";
import type { GraphWorkerRequest, GraphWorkerResponse } from "./GraphWorkerProtocol";
import type { Project } from "~/project-authoring/type/Project";

export interface EditorGraphWorker {
	readonly queryFx: (
		project: Project,
		query: GraphQuerySchema.Type,
	) => Effect.Effect<GraphResult, GraphWorkerError>;
}

/** One scoped Worker per open project; cancellation removes only its own pending request. */
export const createEditorGraphWorkerFx = Effect.fn("createEditorGraphWorkerFx")(function* (
	spawnFn: () => Worker = () => new ProjectGraphWorker(),
) {
	const worker = yield* Effect.try({
		try: spawnFn,
		catch: (cause) =>
			new GraphWorkerError({
				message: String(cause),
			}),
	});
	let nextRequestId = 0;
	let failure: string | undefined;
	const pending = new Map<
		number,
		{
			readonly completeFn: (response: GraphWorkerResponse) => void;
			readonly failFn: (message: string) => void;
		}
	>();
	const failAllFn = (message: string) => {
		failure = message;
		for (const request of [
			...pending.values(),
		])
			request.failFn(message);
	};
	const onMessageFn = ({ data }: MessageEvent<GraphWorkerResponse>) =>
		pending.get(data.requestId)?.completeFn(data);
	const onErrorFn = (event: ErrorEvent) => failAllFn(event.message || "Graph worker failed.");
	const onMessageErrorFn = () => failAllFn("Graph worker response could not be decoded.");
	worker.addEventListener("message", onMessageFn);
	worker.addEventListener("error", onErrorFn);
	worker.addEventListener("messageerror", onMessageErrorFn);
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			failAllFn("Graph worker session closed.");
			worker.removeEventListener("message", onMessageFn);
			worker.removeEventListener("error", onErrorFn);
			worker.removeEventListener("messageerror", onMessageErrorFn);
			worker.terminate();
		}),
	);
	const queryFx = Effect.fn("EditorGraphWorker.queryFx")(
		(project: Project, query: GraphQuerySchema.Type) =>
			Effect.tryPromise({
				try: (signal) =>
					new Promise<GraphResult>((resolveFn, rejectFn) => {
						if (failure !== undefined) {
							rejectFn(new Error(failure));
							return;
						}
						const requestId = ++nextRequestId;
						const cleanUpFn = () => {
							pending.delete(requestId);
							signal.removeEventListener("abort", abortFn);
						};
						const abortFn = () => {
							cleanUpFn();
							worker.postMessage({
								kind: "cancel",
								requestId,
							} satisfies GraphWorkerRequest);
							rejectFn(new Error("Graph query cancelled."));
						};
						pending.set(requestId, {
							completeFn: (response) => {
								cleanUpFn();
								if (response.status === "error")
									rejectFn(new Error(response.message));
								else if (
									response.result.projectId !== project.projectId ||
									response.result.revision !== project.revision
								)
									rejectFn(
										new Error(
											"Graph worker returned another project revision.",
										),
									);
								else resolveFn(response.result);
							},
							failFn: (message) => {
								cleanUpFn();
								rejectFn(new Error(message));
							},
						});
						signal.addEventListener("abort", abortFn, {
							once: true,
						});
						if (signal.aborted) {
							abortFn();
							return;
						}
						try {
							worker.postMessage({
								kind: "query",
								requestId,
								project,
								query,
							} satisfies GraphWorkerRequest);
						} catch (cause) {
							cleanUpFn();
							rejectFn(cause);
						}
					}),
				catch: (cause) =>
					new GraphWorkerError({
						message: cause instanceof Error ? cause.message : String(cause),
					}),
			}),
	);
	return {
		queryFx,
	} satisfies EditorGraphWorker;
});
