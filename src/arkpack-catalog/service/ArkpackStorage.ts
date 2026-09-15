import type { Effect } from "effect";
import type { ArkpackProvenanceSchema } from "~/arkpack-artifact/schema/ArkpackProvenanceSchema";

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

	/** Test/non-Electron admission surface; production Electron never transfers these bytes. */
	export interface MemoryFile extends Identity {
		readonly bytes: ArrayBuffer;
	}

	export interface InstalledFile extends FilesystemFile {
		readonly config: unknown;
		readonly resources: ReadonlyArray<{
			readonly id: string;
			readonly mime: string;
			readonly url: string;
		}>;
	}

	export type File = FilesystemFile | MemoryFile;
	export type Candidate = File;
	export type LoadedFile = InstalledFile | File;
}

/** Effect-native renderer capability for installed Arkpack persistence. */
export interface ArkpackStorage {
	readonly listFx: Effect.Effect<ReadonlyArray<ArkpackStorage.Candidate>, unknown, never>;
	readonly readFx: (
		packageId: string,
	) => Effect.Effect<ReadonlyArray<ArkpackStorage.LoadedFile>, unknown, never>;
	readonly removeFx: (packageId: string) => Effect.Effect<void, unknown, never>;
	readonly importFx?: Effect.Effect<ArkpackStorage.FilesystemFile | null, unknown, never>;
	readonly writeFx: (
		packageId: string,
		bytes: ArrayBuffer,
	) => Effect.Effect<void, unknown, never>;
	readonly openUserDirectoryFx: Effect.Effect<void, unknown, never>;
}
