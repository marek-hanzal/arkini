import type { Effect } from "effect";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";

/** Effect-native main-process capability for installed external Arkpacks. */
export interface ArkpackCatalog {
	readonly listFx: Effect.Effect<ReadonlyArray<ArkiniDesktopApi.ArkpackDescriptor>, unknown>;
	readonly readFx: (
		packageId: string,
	) => Effect.Effect<ArkiniDesktopApi.ArkpackRecord | null, unknown>;
	readonly installFx: (record: ArkiniDesktopApi.ArkpackRecord) => Effect.Effect<void, unknown>;
	readonly removeFx: (packageId: string) => Effect.Effect<void, unknown>;
}
