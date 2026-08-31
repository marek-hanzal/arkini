import type { EditorProject } from "~/project-authoring/type/EditorProject";
import type { ItemEstimate } from "~/estimate/type/ItemEstimate";

export interface ItemEstimateWorkerRequest {
	readonly config: EditorProject["config"];
}

export interface ItemEstimateWorkerResult {
	readonly estimates: ReadonlyArray<ItemEstimate>;
}

export type ItemEstimateWorkerResponse =
	| {
			readonly result: ItemEstimateWorkerResult;
			readonly status: "success";
	  }
	| {
			readonly message: string;
			readonly status: "error";
	  };
