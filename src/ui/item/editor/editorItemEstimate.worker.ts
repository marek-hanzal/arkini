import { Effect } from "effect";

import { estimateEditorItemIndexFx } from "~/editor/estimateEditorItemIndexFx";
import { simulateEditorItemFx } from "~/editor/simulator/simulateEditorItemFx";
import { EditorItemEstimateWorkerRuntime } from "~/ui/item/editor/EditorItemEstimateWorkerRuntime";
import type {
	EditorItemEstimateWorkerRequest,
	EditorItemEstimateWorkerResponse,
	EditorItemEstimateWorkerResult,
} from "~/ui/item/editor/editorItemEstimateWorkerProtocol";

self.addEventListener("message", ({ data }: MessageEvent<EditorItemEstimateWorkerRequest>) => {
	try {
		const result: EditorItemEstimateWorkerResult = EditorItemEstimateWorkerRuntime.runSync(
			Effect.gen(function* () {
				switch (data.type) {
					case "index":
						return {
							entries: yield* estimateEditorItemIndexFx(data.config, (progress) =>
								self.postMessage({
									progress,
									status: "progress",
								} satisfies EditorItemEstimateWorkerResponse),
							),
							type: "index",
						};
					case "item":
						return {
							estimate: yield* simulateEditorItemFx(data.config, data.itemId),
							type: "item",
						};
				}
			}),
		);
		self.postMessage({
			result,
			status: "success",
		} satisfies EditorItemEstimateWorkerResponse);
	} catch (cause) {
		self.postMessage({
			message: cause instanceof Error ? cause.message : String(cause),
			status: "error",
		} satisfies EditorItemEstimateWorkerResponse);
	}
});
