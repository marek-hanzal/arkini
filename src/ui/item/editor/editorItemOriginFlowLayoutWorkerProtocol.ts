import type {
	EditorItemOriginFlowLayout,
	EditorItemOriginFlowLayoutInput,
} from "~/ui/item/editor/editorItemOriginFlowLayout";

export interface EditorItemOriginFlowLayoutWorkerRequest {
	readonly topology: EditorItemOriginFlowLayoutInput;
}

export type EditorItemOriginFlowLayoutWorkerResponse =
	| {
			readonly layout: EditorItemOriginFlowLayout;
			readonly status: "success";
	  }
	| {
			readonly message: string;
			readonly status: "error";
	  };
