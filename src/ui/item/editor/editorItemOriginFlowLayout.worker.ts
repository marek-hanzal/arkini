import * as BrowserWorkerRunner from "@effect/platform-browser/BrowserWorkerRunner";
import { Effect } from "effect";
import * as WorkerRunner from "effect/unstable/workers/WorkerRunner";

import type {
	EditorItemOriginFlowLayoutWorkerRequest,
	EditorItemOriginFlowLayoutWorkerResponse,
} from "~/ui/item/editor/EditorItemOriginFlowLayoutWorker";
import { layoutEditorItemOriginFlow } from "~/ui/item/editor/layoutEditorItemOriginFlow";

const run = Effect.gen(function* () {
	const platform = yield* WorkerRunner.WorkerRunnerPlatform;
	const runner = yield* platform.start<
		EditorItemOriginFlowLayoutWorkerResponse,
		EditorItemOriginFlowLayoutWorkerRequest
	>();
	yield* runner.run((portId, request) =>
		Effect.try({
			try: () => layoutEditorItemOriginFlow(request.topology),
			catch: (cause) => (cause instanceof Error ? cause.message : String(cause)),
		}).pipe(
			Effect.flatMap((positions) =>
				runner.send(portId, {
					generation: request.generation,
					positions: [
						...positions,
					],
					type: "success",
				}),
			),
			Effect.catch((message) =>
				runner.send(portId, {
					generation: request.generation,
					message,
					type: "error",
				}),
			),
		),
	);
}).pipe(Effect.provide(BrowserWorkerRunner.layer));

Effect.runFork(run);
