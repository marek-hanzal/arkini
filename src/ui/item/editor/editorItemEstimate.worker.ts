import { Effect } from "effect";

import { createEditorAcquisitionGraphFx } from "~/editor/createEditorAcquisitionGraphFx";
import { estimateEditorItemFx } from "~/editor/estimator/estimateEditorItemFx";
import { EditorItemEstimateWorkerRuntime } from "~/ui/item/editor/EditorItemEstimateWorkerRuntime";
import type {
	EditorItemEstimateWorkerRequest,
	EditorItemEstimateWorkerResponse,
} from "~/ui/item/editor/editorItemEstimateWorkerProtocol";

self.addEventListener("message", ({ data }: MessageEvent<EditorItemEstimateWorkerRequest>) => {
	void EditorItemEstimateWorkerRuntime.runPromise(
		Effect.gen(function* () {
			const graph = yield* createEditorAcquisitionGraphFx(data.config);
			return yield* Effect.forEach(Object.keys(data.config.items).sort(), (itemId) =>
				estimateEditorItemFx({
					factId: itemId,
					graph,
					quantity: 1,
				}),
			);
		}),
	).then(
		(estimates) =>
			self.postMessage({
				result: {
					estimates,
				},
				status: "success",
			} satisfies EditorItemEstimateWorkerResponse),
		(cause) =>
			self.postMessage({
				message: cause instanceof Error ? cause.message : String(cause),
				status: "error",
			} satisfies EditorItemEstimateWorkerResponse),
	);
});
