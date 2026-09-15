import type { Effect } from "effect";
import type { ArkpackProvenanceSchema } from "~/arkpack-artifact/schema/ArkpackProvenanceSchema";
import type { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

export namespace ArkpackStorage {
	interface Identity {
		readonly packageId: string;
		readonly filename: string;
		readonly provenance: ArkpackProvenanceSchema.Type;
		readonly source: "bundled" | "user";
		readonly overridesBundled: boolean;
	}

	export interface FilesystemFile extends Identity {
		readonly contentHash: string;
		readonly title: string;
		readonly version: string;
		readonly arkini: string;
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

/** Effect-native renderer capability for installed Arkpack persistence. */
export interface ArkpackStorage {
	readonly listFx: Effect.Effect<ReadonlyArray<ArkpackStorage.Candidate>, unknown, never>;
	readonly readFx: (
		packageId: string,
	) => Effect.Effect<ReadonlyArray<ArkpackStorage.LoadedFile>, unknown, never>;
	readonly removeFx: (packageId: string) => Effect.Effect<void, unknown, never>;
	readonly importFx?: Effect.Effect<ArkpackStorage.FilesystemFile | null, unknown, never>;
	readonly installEditorBuildFx?: (props: {
		readonly packageId: string;
		readonly expectedRevision: number;
		readonly contentHash: string;
	}) => Effect.Effect<ArkpackStorage.FilesystemFile, unknown, never>;
	readonly openUserDirectoryFx: Effect.Effect<void, unknown, never>;
}
