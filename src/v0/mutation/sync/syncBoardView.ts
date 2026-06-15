import type { QueryClient } from "@tanstack/react-query";
import { loadPlayBackend } from "~/v0/query/loadPlayBackend";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export namespace syncBoardView {
	export interface Props {
		queryClient: QueryClient;
	}
}

export const syncBoardView = async ({ queryClient }: syncBoardView.Props) => {
	const db = await loadPlayBackend();
	queryClient.setQueryData(playQueryKeys.board, await db.readBoardView());
};
