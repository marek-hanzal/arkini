import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorItemSimulation } from "~/editor/simulator/EditorItemSimulation";

export interface EditorItemEstimateWorkerRequest {
	readonly config: EditorProject["config"];
	readonly itemId: string;
	readonly quantity: number;
	readonly type: "item";
}

export interface EditorItemEstimateWorkerResult {
	readonly estimate: EditorItemSimulation;
	readonly type: "item";
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
