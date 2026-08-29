import type { EditorProject } from "~/project-authoring/EditorProject";
import type { EditorItemEstimate } from "~/estimate/domain/EditorItemEstimate";

export interface EditorItemEstimateWorkerRequest {
	readonly config: EditorProject["config"];
}

export interface EditorItemEstimateWorkerResult {
	readonly estimates: ReadonlyArray<EditorItemEstimate>;
}

export type EditorItemEstimateWorkerResponse =
	| {
			readonly result: EditorItemEstimateWorkerResult;
			readonly status: "success";
	  }
	| {
			readonly message: string;
			readonly status: "error";
	  };
