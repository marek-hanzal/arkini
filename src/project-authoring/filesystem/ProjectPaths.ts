import type { Effect } from "effect";

import type { TypeSchema } from "~/item-definition/schema/TypeSchema";

/** Complete path grammar below one portable Editor project root. */
export interface ProjectPaths {
	readonly root: string;
	readonly build: string;
	readonly gitignoreFile: string;
	readonly projectFile: string;
	readonly lockFile: string;
	readonly schemaFile: string;
	readonly gameFile: string;
	readonly items: string;
	readonly assets: string;
	readonly resources: string;
	readonly notes: string;
	readonly itemFileFx: (props: {
		readonly type: TypeSchema.Type;
		readonly uid: string;
	}) => Effect.Effect<string, never, never>;
	readonly assetFileFx: (resourceId: string) => Effect.Effect<string, Error, never>;
	readonly resourceFileFx: (resourceId: string) => Effect.Effect<string, Error, never>;
	readonly noteFileFx: (noteId: string) => Effect.Effect<string, never, never>;
}
