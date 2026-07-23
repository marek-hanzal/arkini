import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { readDropItemPreviewFx } from "~/engine/runtime/read/readDropItemPreviewFx";

export namespace useDropItemPreview {
	export type Props = readDropItemPreviewFx.Props;
	export type Result = readDropItemPreviewFx.Result;
}

/** Reads the authoritative semantic kind of one prospective tile drop without mutating runtime. */
export const useDropItemPreview = () => {
	const game = useGameEngine();
	return useCallback(
		(props: useDropItemPreview.Props): useDropItemPreview.Result =>
			game.readOrThrow(readDropItemPreviewFx(props)),
		[
			game,
		],
	);
};
