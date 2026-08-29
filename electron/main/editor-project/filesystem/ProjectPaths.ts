import type { Effect } from "effect";

import type { EditorObjectHashSchema } from "~/project-version/EditorObjectHashSchema";
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
	readonly scenarios: string;
	readonly versions: string;
	readonly versionHeadFile: string;
	readonly objects: string;
	readonly itemFileFx: (props: {
		readonly type: TypeSchema.Type;
		readonly uid: string;
	}) => Effect.Effect<string>;
	readonly assetFileFx: (resourceId: string) => Effect.Effect<string, Error>;
	readonly resourceFileFx: (resourceId: string) => Effect.Effect<string, Error>;
	readonly noteFileFx: (noteId: string) => Effect.Effect<string>;
	readonly scenarioFileFx: (name: string) => Effect.Effect<string>;
	readonly versionDirectoryFx: (versionId: string) => Effect.Effect<string>;
	readonly versionDescriptorFileFx: (versionId: string) => Effect.Effect<string>;
	readonly versionManifestFileFx: (versionId: string) => Effect.Effect<string>;
	readonly jsonObjectFileFx: (hash: EditorObjectHashSchema.Type) => Effect.Effect<string>;
	readonly pngObjectFileFx: (hash: EditorObjectHashSchema.Type) => Effect.Effect<string>;
}
