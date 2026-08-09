import { Effect } from "effect";

import { layoutEditorItemOriginFlowFx } from "~/ui/item/editor/layoutEditorItemOriginFlowFx";
import type {
	EditorItemOriginFlowLayoutWorkerRequest,
	EditorItemOriginFlowLayoutWorkerResponse,
} from "~/ui/item/editor/editorItemOriginFlowLayoutWorkerProtocol";

self.addEventListener(
	"message",
	({ data }: MessageEvent<EditorItemOriginFlowLayoutWorkerRequest>) => {
		try {
			const layout = Effect.runSync(layoutEditorItemOriginFlowFx(data.topology));
			self.postMessage({
				layout,
				status: "success",
			} satisfies EditorItemOriginFlowLayoutWorkerResponse);
		} catch (cause) {
			self.postMessage({
				message: cause instanceof Error ? cause.message : String(cause),
				status: "error",
			} satisfies EditorItemOriginFlowLayoutWorkerResponse);
		}
	},
);
