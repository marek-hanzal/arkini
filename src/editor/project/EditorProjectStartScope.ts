export const EditorProjectStartScopes = [
	"board",
	"inventory",
	"toolbar",
] as const;

export type EditorProjectStartScope = (typeof EditorProjectStartScopes)[number];
