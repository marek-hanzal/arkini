import { estimateEditorItemCatalogFn } from "~/estimate/fn/estimateEditorItemCatalogFn";
import type {
	EditorItemEstimateWorkerRequest,
	EditorItemEstimateWorkerResponse,
} from "~/estimate/worker/editorItemEstimateWorkerProtocol";

self.addEventListener("message", ({ data }: MessageEvent<EditorItemEstimateWorkerRequest>) => {
	try {
		self.postMessage({
			result: {
				estimates: estimateEditorItemCatalogFn(data.config),
			},
			status: "success",
		} satisfies EditorItemEstimateWorkerResponse);
	} catch (cause) {
		self.postMessage({
			message: cause instanceof Error ? cause.message : String(cause),
			status: "error",
		} satisfies EditorItemEstimateWorkerResponse);
	}
});
