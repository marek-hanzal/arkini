import { useMemo } from "react";
import type { DropActions } from "~/play/drop/DropActions";
import { useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import { createGameRuntimeDropActions } from "~/play/runtime/drop/createGameRuntimeDropActions";

export const useGameRuntimeDropActions = (): DropActions => {
	const store = useGameRuntimeStore();

	return useMemo(
		() =>
			createGameRuntimeDropActions({
				store,
			}),
		[
			store,
		],
	);
};
