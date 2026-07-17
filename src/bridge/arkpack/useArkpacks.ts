import { useCallback, useEffect, useRef, useState } from "react";

import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import { importArkpackFileFx } from "~/bridge/arkpack/importArkpackFileFx";
import { listArkpacksFx } from "~/bridge/arkpack/listArkpacksFx";
import { removeArkpackFx } from "~/bridge/arkpack/removeArkpackFx";
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

/** Owns only launcher catalog request state; package truth remains in persistent arkpack storage. */
export const useArkpacks = (): useArkpacks.Result => {
	const [state, setState] = useState<useArkpacks.State>({
		type: "loading",
	});
	const request = useRef(0);
	const refresh = useCallback(async () => {
		const requestId = ++request.current;
		try {
			setState({
				type: "loading",
			});
			const arkpacks = await RendererRuntime.runPromise(listArkpacksFx());
			if (request.current === requestId) {
				setState({
					type: "ready",
					arkpacks,
				});
			}
		} catch (error) {
			if (request.current === requestId) {
				setState({
					type: "failed",
					error,
				});
			}
		}
	}, []);

	useEffect(() => {
		void refresh();
		return () => {
			request.current += 1;
		};
	}, [
		refresh,
	]);

	const importFile = useCallback(
		async (file: File) => {
			const descriptor = await RendererRuntime.runPromise(
				importArkpackFileFx({
					file,
				}),
			);
			await refresh();
			return descriptor;
		},
		[
			refresh,
		],
	);
	const remove = useCallback(
		async (packageId: string) => {
			await RendererRuntime.runPromise(
				removeArkpackFx({
					packageId,
				}),
			);
			await refresh();
		},
		[
			refresh,
		],
	);

	return {
		state,
		importFile,
		remove,
		refresh,
	};
};
