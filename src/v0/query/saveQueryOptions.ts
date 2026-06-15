import { queryOptions } from "@tanstack/react-query";
import { readSaveFx } from "~/play/fx/readSaveFx";
import { runGameFx } from "~/v0/fx/runGameFx";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export const saveQueryOptions = () =>
	queryOptions({
		queryKey: playQueryKeys.save,
		queryFn() {
			return runGameFx({
				effect: readSaveFx(),
			});
		},
	});
