import type { QueryClient } from "@tanstack/react-query";
import type { mergeBoardItemsFx } from "~/v0/board/fx/mergeBoardItemsFx";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { patchBoardViewCache } from "~/v0/board/cache/patchBoardViewCache";

export namespace applyBoardMergeCachePatch {
	export interface Props {
		queryClient: QueryClient;
		input: mergeBoardItemsFx.Props;
	}
}

export const applyBoardMergeCachePatch = ({
	queryClient,
}: applyBoardMergeCachePatch.Props): CacheSnapshot.Type => ({
	board: patchBoardViewCache({
		queryClient,
		patch: (board) => board,
	}),
});
