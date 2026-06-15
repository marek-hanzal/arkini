import { queryOptions } from "@tanstack/react-query";
import { loadPlayBackend } from "~/v0/query/loadPlayBackend";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export const saveQueryOptions = () =>
	queryOptions({
		queryKey: playQueryKeys.save,
		async queryFn() {
			const db = await loadPlayBackend();
			return db.readGameSaveView();
		},
	});
