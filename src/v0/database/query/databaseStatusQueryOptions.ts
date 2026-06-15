import { queryOptions } from "@tanstack/react-query";
import { readDatabaseStatusFx } from "~/v0/database/fx/readDatabaseStatusFx";
import { runGameFx } from "~/v0/fx/runGameFx";
import { databaseQueryKeys } from "~/v0/database/query/databaseQueryKeys";

export const databaseStatusQueryOptions = () =>
	queryOptions({
		queryKey: databaseQueryKeys.status,
		queryFn() {
			return runGameFx({
				effect: readDatabaseStatusFx(),
			});
		},
	});
