import type { Effect } from "effect";
import type { SerapackProvenanceSchema } from "~/serapack-artifact/schema/SerapackProvenanceSchema";
import type { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

export namespace SerapackStorage {
	interface Identity {
		readonly packageId: string;
		readonly filename: string;
		readonly provenance: SerapackProvenanceSchema.Type;
		readonly source: "bundled" | "user";
		readonly overridesBundled: boolean;
	}

	export interface FilesystemFile extends Identity {
		readonly contentHash: string;
		readonly title: string;
		readonly version: string;
		readonly serakki: string;
		readonly projectRevision: number;
	}

	export interface InstalledFile extends FilesystemFile {
		readonly config: unknown;
		readonly resources: ReadonlyArray<{
			readonly id: string;
			readonly type: ResourceTypeSchema.Type;
			readonly url: string;
		}>;
	}

	export type Candidate = FilesystemFile;
	export type LoadedFile = InstalledFile;
}

/** Effect-native renderer capability for installed Serapack persistence. */
export interface SerapackStorage {
	readonly listFx: Effect.Effect<ReadonlyArray<SerapackStorage.Candidate>, unknown, never>;
	readonly readFx: (
		packageId: string,
	) => Effect.Effect<ReadonlyArray<SerapackStorage.LoadedFile>, unknown, never>;
	readonly removeFx: (packageId: string) => Effect.Effect<void, unknown, never>;
	readonly importFx?: Effect.Effect<SerapackStorage.FilesystemFile | null, unknown, never>;
	readonly installEditorBuildFx?: (props: {
		readonly packageId: string;
		readonly expectedRevision: number;
		readonly contentHash: string;
	}) => Effect.Effect<SerapackStorage.FilesystemFile, unknown, never>;
	readonly openUserDirectoryFx: Effect.Effect<void, unknown, never>;
}
