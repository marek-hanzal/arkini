import { queryOptions } from "@tanstack/react-query";
import { readViewFx } from "~/board/fx/readViewFx";
import { runGameFx } from "~/v0/fx/runGameFx";
import { boardQueryKeys } from "~/v0/board/query/boardQueryKeys";

export const boardViewQueryOptions = () =>
	queryOptions({
		queryKey: boardQueryKeys.view,
		queryFn() {
			return runGameFx({
				effect: readViewFx(),
			});
		},
	});
