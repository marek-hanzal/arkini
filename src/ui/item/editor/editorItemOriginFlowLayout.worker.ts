import { Effect } from "effect";

import {
	type EditorItemOriginFlowLayout,
	type EditorItemOriginFlowLayoutInput,
	layoutEditorItemOriginFlowFx,
} from "~/ui/item/editor/layoutEditorItemOriginFlowFx";

type LayoutWorkerRequest = {
	readonly topology: EditorItemOriginFlowLayoutInput;
};

type LayoutWorkerResponse =
	| {
			readonly layout: EditorItemOriginFlowLayout;
			readonly status: "success";
	  }
	| {
			readonly message: string;
			readonly status: "error";
	  };

self.addEventListener("message", ({ data }: MessageEvent<LayoutWorkerRequest>) => {
	try {
		const layout = Effect.runSync(layoutEditorItemOriginFlowFx(data.topology));
		self.postMessage({
			layout,
			status: "success",
		} satisfies LayoutWorkerResponse);
	} catch (cause) {
		self.postMessage({
			message: cause instanceof Error ? cause.message : String(cause),
			status: "error",
		} satisfies LayoutWorkerResponse);
	}
});
