import type { EditorProjectCompatibilityPath } from "~/project-version/type/EditorProjectCompatibility";

export type EditorProjectSemanticDiff =
	| {
			readonly after: unknown;
			readonly operation: "add";
			readonly path: EditorProjectCompatibilityPath;
	  }
	| {
			readonly before: unknown;
			readonly operation: "remove";
			readonly path: EditorProjectCompatibilityPath;
	  }
	| {
			readonly after: unknown;
			readonly before: unknown;
			readonly operation: "change";
			readonly path: EditorProjectCompatibilityPath;
	  };
