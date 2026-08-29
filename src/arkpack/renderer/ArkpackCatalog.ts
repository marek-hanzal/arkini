import type { Effect, SubscriptionRef } from "effect";
import type { ArkpackDescriptor } from "~/arkpack/ArkpackDescriptor";

export namespace ArkpackCatalog {
	export type State =
		| {
				readonly type: "loading";
		  }
		| {
				readonly type: "ready";
				readonly arkpacks: ReadonlyArray<ArkpackDescriptor>;
		  }
		| {
				readonly type: "failed";
				readonly error: unknown;
		  };

	export interface Props {
		readonly listFx?: Effect.Effect<ReadonlyArray<ArkpackDescriptor>, unknown>;
		readonly importFileFx?: (file: File) => Effect.Effect<ArkpackDescriptor, unknown>;
		readonly installFx?: (props: {
			readonly bytes: Uint8Array;
			readonly filename: string;
			readonly packageId: string;
		}) => Effect.Effect<ArkpackDescriptor, unknown>;
		readonly removeFx?: (packageId: string) => Effect.Effect<void, unknown>;
	}

	export interface PackageSnapshot {
		readonly packageId: string;
		readonly contentHash: string;
		readonly version: ArkpackDescriptor["version"];
	}

	export interface InstallContent {
		readonly bytes: Uint8Array;
	}
}

/** Stable renderer owner of one shared Arkpack catalog request state. */
export interface ArkpackCatalog {
	/** Joins catalog mutations admitted before this Effect acquires the catalog boundary. */
	readonly awaitIdleFx: Effect.Effect<void>;
	readonly state: SubscriptionRef.SubscriptionRef<ArkpackCatalog.State>;
	readonly refreshFx: Effect.Effect<void, unknown>;
	readonly importFileFx: (file: File) => Effect.Effect<ArkpackDescriptor, unknown>;
	readonly installFx: (props: {
		readonly contentFx: Effect.Effect<ArkpackCatalog.InstallContent, unknown>;
		readonly expectedCurrent: ArkpackCatalog.PackageSnapshot | null;
		readonly filename: string;
		readonly packageId: string;
	}) => Effect.Effect<ArkpackDescriptor, unknown>;
	readonly removeFx: (packageId: string) => Effect.Effect<void, unknown>;
}
