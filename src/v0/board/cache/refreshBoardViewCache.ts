import type { QueryClient } from "@tanstack/react-query";
import { boardViewQueryOptions } from "~/v0/board/query/boardViewQueryOptions";

export namespace refreshBoardViewCache {
	export interface Props {
		queryClient: QueryClient;
	}
}

export const refreshBoardViewCache = ({ queryClient }: refreshBoardViewCache.Props) =>
	queryClient.fetchQuery(boardViewQueryOptions());
