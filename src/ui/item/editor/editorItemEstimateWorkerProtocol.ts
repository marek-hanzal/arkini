import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorItemEstimate } from "~/editor/estimator/EditorItemEstimate";

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
