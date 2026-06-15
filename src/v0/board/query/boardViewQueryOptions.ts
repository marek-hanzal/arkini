import { queryOptions } from "@tanstack/react-query";
import { readBoardViewFx } from "~/v0/board/fx/readBoardViewFx";
import { runGameFx } from "~/v0/fx/runGameFx";
import { boardQueryKeys } from "~/v0/board/query/boardQueryKeys";

export const boardViewQueryOptions = () =>
	queryOptions({
		queryKey: boardQueryKeys.view,
		queryFn() {
			return runGameFx({
				effect: readBoardViewFx(),
			});
		},
	});
