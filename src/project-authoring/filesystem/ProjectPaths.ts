import type { Effect } from "effect";
import type { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

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
	readonly artwork: string;
	readonly image: string;
	readonly notes: string;
	readonly itemFileFx: (props: { readonly uid: string }) => Effect.Effect<string, never, never>;
	readonly artworkFileFx: (resourceUid: string) => Effect.Effect<string, Error, never>;
	readonly imageFileFx: (resourceUid: string) => Effect.Effect<string, Error, never>;
	readonly resourceFileFx: (props: {
		readonly uid: string;
		readonly type: ResourceTypeSchema.Type;
	}) => Effect.Effect<string, Error, never>;
	readonly resourceMetadataFileFx: (props: {
		readonly uid: string;
		readonly type: ResourceTypeSchema.Type;
	}) => Effect.Effect<string, Error, never>;
	readonly noteFileFx: (noteId: string) => Effect.Effect<string, never, never>;
}
