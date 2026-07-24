import type { Effect } from "effect";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import type { ElectronMainError } from "../ElectronMainError";

/** Effect-native main-process capability for installed external Arkpacks. */
export interface ArkpackCatalog {
	readonly listFx: Effect.Effect<
		ReadonlyArray<ArkiniElectronApi.ArkpackDescriptor>,
		ElectronMainError
	>;
	readonly readFx: (
		packageId: string,
	) => Effect.Effect<ArkiniElectronApi.ArkpackRecord | null, ElectronMainError>;
	readonly installFx: (
		record: ArkiniElectronApi.ArkpackRecord,
	) => Effect.Effect<void, ElectronMainError>;
	readonly removeFx: (packageId: string) => Effect.Effect<void, ElectronMainError>;
}
