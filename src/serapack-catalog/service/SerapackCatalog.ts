import type { Effect, SubscriptionRef } from "effect";
import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";

export namespace SerapackCatalog {
	export type State =
		| {
				readonly type: "loading";
		  }
		| {
				readonly type: "ready";
				readonly serapacks: ReadonlyArray<SerapackDescriptor>;
		  }
		| {
				readonly type: "failed";
				readonly error: unknown;
		  };

	export interface Props {
		readonly listFx?: Effect.Effect<ReadonlyArray<SerapackDescriptor>, unknown, never>;
		readonly importFileFx?: () => Effect.Effect<SerapackDescriptor | null, unknown, never>;
		readonly installFx?: (props: {
			readonly packageId: string;
			readonly expectedRevision: number;
			readonly contentHash: string;
		}) => Effect.Effect<SerapackDescriptor, unknown, never>;
		readonly removeFx?: (packageId: string) => Effect.Effect<void, unknown, never>;
	}

	export interface PackageSnapshot {
		readonly packageId: string;
		readonly contentHash: string;
		readonly version: SerapackDescriptor["version"];
	}
}

/** Stable renderer owner of one shared Serapack catalog request state. */
export interface SerapackCatalog {
	/** Joins catalog mutations admitted before this Effect acquires the catalog boundary. */
	readonly awaitIdleFx: Effect.Effect<void, never, never>;
	readonly state: SubscriptionRef.SubscriptionRef<SerapackCatalog.State>;
	readonly refreshFx: Effect.Effect<void, unknown, never>;
	readonly importFileFx: () => Effect.Effect<SerapackDescriptor | null, unknown, never>;
	readonly installFx: (props: {
		readonly expectedRevision: number;
		readonly contentHash: string;
		readonly expectedCurrent: SerapackCatalog.PackageSnapshot | null;
		readonly packageId: string;
	}) => Effect.Effect<SerapackDescriptor, unknown, never>;
	readonly removeFx: (packageId: string) => Effect.Effect<void, unknown, never>;
}
