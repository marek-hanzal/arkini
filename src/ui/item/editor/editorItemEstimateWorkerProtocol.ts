import type { EditorProject } from "~/bridge/editor/EditorProject";
import type {
	EditorItemEstimateIndexEntry,
	EditorItemEstimateIndexProgress,
} from "~/editor/EditorItemEstimateIndex";
import type { EditorItemSimulation } from "~/editor/simulator/EditorItemSimulation";

export type EditorItemEstimateWorkerRequest =
	| {
			readonly config: EditorProject["config"];
			readonly type: "index";
	  }
	| {
			readonly config: EditorProject["config"];
			readonly itemId: string;
			readonly type: "item";
	  };

export type EditorItemEstimateWorkerResult =
	| {
			readonly entries: ReadonlyArray<EditorItemEstimateIndexEntry>;
			readonly type: "index";
	  }
	| {
			readonly estimate: EditorItemSimulation;
			readonly type: "item";
	  };

export type EditorItemEstimateWorkerResponse =
	| {
			readonly progress: EditorItemEstimateIndexProgress;
			readonly status: "progress";
	  }
	| {
			readonly result: EditorItemEstimateWorkerResult;
			readonly status: "success";
	  }
	| {
			readonly message: string;
			readonly status: "error";
	  };
