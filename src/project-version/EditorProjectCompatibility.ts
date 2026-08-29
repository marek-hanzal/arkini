export type EditorProjectCompatibilityResult = "noop" | "minor" | "major";
export type EditorProjectCompatibilityDiffResult = Exclude<
	EditorProjectCompatibilityResult,
	"noop"
>;
export type EditorProjectCompatibilityPath = ReadonlyArray<string | number>;
export type EditorProjectCompatibilityRule =
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

interface EditorProjectCompatibilityContextBase {
	readonly message: string;
	readonly path: EditorProjectCompatibilityPath;
	readonly result: EditorProjectCompatibilityDiffResult;
	readonly rule: EditorProjectCompatibilityRule;
}

export type EditorProjectCompatibilityContext =
	| (EditorProjectCompatibilityContextBase & {
			readonly after: unknown;
			readonly operation: "add";
	  })
	| (EditorProjectCompatibilityContextBase & {
			readonly before: unknown;
			readonly operation: "remove";
	  })
	| (EditorProjectCompatibilityContextBase & {
			readonly after: unknown;
			readonly before: unknown;
			readonly operation: "change";
	  });

export interface EditorProjectCompatibility {
	readonly result: EditorProjectCompatibilityResult;
	readonly context: ReadonlyArray<EditorProjectCompatibilityContext>;
}
