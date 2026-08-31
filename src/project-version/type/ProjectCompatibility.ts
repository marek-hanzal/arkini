export type ProjectCompatibilityResult = "noop" | "minor" | "major";
export type ProjectCompatibilityDiffResult = Exclude<ProjectCompatibilityResult, "noop">;
export type ProjectCompatibilityPath = ReadonlyArray<string | number>;
export type ProjectCompatibilityRule =
	| "game-title"
	| "item-title"
	| "item-description"
	| "line-title"
	| "line-description"
	| "line-runtime"
	| "temporary-duration"
	| "surface-grown"
	| "surface-shrunk"
	| "unclassified-change";

interface ProjectCompatibilityContextBase {
	readonly message: string;
	readonly path: ProjectCompatibilityPath;
	readonly result: ProjectCompatibilityDiffResult;
	readonly rule: ProjectCompatibilityRule;
}

export type ProjectCompatibilityContext =
	| (ProjectCompatibilityContextBase & {
			readonly after: unknown;
			readonly operation: "add";
	  })
	| (ProjectCompatibilityContextBase & {
			readonly before: unknown;
			readonly operation: "remove";
	  })
	| (ProjectCompatibilityContextBase & {
			readonly after: unknown;
			readonly before: unknown;
			readonly operation: "change";
	  });

export interface ProjectCompatibility {
	readonly result: ProjectCompatibilityResult;
	readonly context: ReadonlyArray<ProjectCompatibilityContext>;
}
