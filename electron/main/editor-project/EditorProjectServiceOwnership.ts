import type { SqliteEditorProjectRepository } from "./sqlite/fx/createSqliteEditorProjectRepositoryFx";

/** Editor persistence may fail independently; gameplay must still boot. */
export type EditorProjectServiceOwnership =
	| {
			readonly type: "ready";
			readonly repository: SqliteEditorProjectRepository;
	  }
	| {
			readonly type: "unavailable";
			readonly message: string;
	  };
