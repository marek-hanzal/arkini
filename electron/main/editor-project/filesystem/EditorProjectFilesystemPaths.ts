import type { Effect } from "effect";

import type { EditorObjectHashSchema } from "~/editor/filesystem/EditorObjectHashSchema";
import type { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

/** Complete path grammar below one portable Editor project root. */
export interface EditorProjectFilesystemPaths {
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
		readonly type: ItemEnumSchema.Type;
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
