import { useCallback, useSyncExternalStore } from "react";

import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import { useArkpackCatalog } from "~/bridge/arkpack/useArkpackCatalog";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

export namespace useArkpacks {
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

	export interface Result {
		readonly state: State;
		readonly importFile: (file: File) => Promise<ArkpackDescriptor>;
		readonly remove: (packageId: string) => Promise<void>;
		readonly refresh: () => Promise<void>;
	}
}

/** Reads and mutates the one root-owned Arkpack catalog without creating another cache. */
export const useArkpacks = (): useArkpacks.Result => {
	const catalog = useArkpackCatalog();
	const state = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot, catalog.getSnapshot);
	const refresh = useCallback(
		() => RendererRuntime.runPromise(catalog.refreshFx),
		[
			catalog,
		],
	);
	const importFile = useCallback(
		(file: File) => RendererRuntime.runPromise(catalog.importFileFx(file)),
		[
			catalog,
		],
	);
	const remove = useCallback(
		(packageId: string) => RendererRuntime.runPromise(catalog.removeFx(packageId)),
		[
			catalog,
		],
	);

	return {
		state,
		importFile,
		remove,
		refresh,
	};
};
