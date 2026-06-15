import { queryOptions } from "@tanstack/react-query";
import { readViewFx } from "~/board/fx/readViewFx";
import { runGameFx } from "~/v0/fx/runGameFx";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export const boardViewQueryOptions = () =>
	queryOptions({
		queryKey: playQueryKeys.board,
		queryFn() {
			return runGameFx({
				effect: readViewFx(),
			});
		},
	});
