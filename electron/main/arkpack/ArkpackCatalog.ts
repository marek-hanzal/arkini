import type { Effect } from "effect";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";

/** Effect-native main-process capability for installed external Arkpacks. */
export interface ArkpackCatalog {
	readonly listFx: Effect.Effect<ReadonlyArray<ArkiniElectronApi.ArkpackDescriptor>, unknown>;
	readonly readFx: (
		packageId: string,
	) => Effect.Effect<ArkiniElectronApi.ArkpackRecord | null, unknown>;
	readonly installFx: (record: ArkiniElectronApi.ArkpackRecord) => Effect.Effect<void, unknown>;
	readonly removeFx: (packageId: string) => Effect.Effect<void, unknown>;
}
