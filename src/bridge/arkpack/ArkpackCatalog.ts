import type { Effect } from "effect";
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";

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
		readonly removeFx?: (packageId: string) => Effect.Effect<void, unknown>;
	}
}

/** Stable renderer owner of one shared Arkpack catalog request state. */
export interface ArkpackCatalog {
	readonly getSnapshot: () => ArkpackCatalog.State;
	readonly refreshFx: Effect.Effect<void, unknown>;
	readonly importFileFx: (file: File) => Effect.Effect<ArkpackDescriptor, unknown>;
	readonly removeFx: (packageId: string) => Effect.Effect<void, unknown>;
	readonly subscribe: (listener: () => void | PromiseLike<void>) => () => void;
}
