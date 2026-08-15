import { simulateEditorItemFx } from "~/editor/simulator/simulateEditorItemFx";
import { EditorItemEstimateWorkerRuntime } from "~/ui/item/editor/EditorItemEstimateWorkerRuntime";
import type {
	EditorItemEstimateWorkerRequest,
	EditorItemEstimateWorkerResponse,
} from "~/ui/item/editor/editorItemEstimateWorkerProtocol";

self.addEventListener("message", ({ data }: MessageEvent<EditorItemEstimateWorkerRequest>) => {
	void EditorItemEstimateWorkerRuntime.runPromise(
		simulateEditorItemFx(data.config, data.itemId, data.quantity),
	).then(
		(estimate) =>
			self.postMessage({
				result: {
					estimate,
					type: "item",
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
