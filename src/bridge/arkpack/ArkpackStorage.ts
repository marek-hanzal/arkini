import type { Effect } from "effect";

export namespace ArkpackStorage {
	export interface File {
		readonly packageId: string;
		readonly filename: string;
		readonly bytes: ArrayBuffer;
		readonly signature?: unknown;
		readonly source: "bundled" | "user";
		readonly overridesBundled: boolean;
	}
}

/** Effect-native renderer capability for installed Arkpack persistence. */
export interface ArkpackStorage {
	readonly listFx: Effect.Effect<ReadonlyArray<ArkpackStorage.File>, unknown>;
	readonly readFx: (
		packageId: string,
	) => Effect.Effect<ReadonlyArray<ArkpackStorage.File>, unknown>;
	readonly removeFx: (packageId: string) => Effect.Effect<void, unknown>;
	readonly writeFx: (
		packageId: string,
		bytes: ArrayBuffer,
		signature?: unknown,
	) => Effect.Effect<void, unknown>;
	readonly openUserDirectoryFx: Effect.Effect<void, unknown>;
}
