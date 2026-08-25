import { estimateEditorItemsFx } from "~/editor/estimateEditorItemsFx";
import { EditorItemEstimateWorkerRuntime } from "~/ui/item/editor/EditorItemEstimateWorkerRuntime";
import type {
	EditorItemEstimateWorkerRequest,
	EditorItemEstimateWorkerResponse,
} from "~/ui/item/editor/editorItemEstimateWorkerProtocol";

self.addEventListener("message", ({ data }: MessageEvent<EditorItemEstimateWorkerRequest>) => {
	void EditorItemEstimateWorkerRuntime.runPromise(estimateEditorItemsFx(data.config)).then(
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
