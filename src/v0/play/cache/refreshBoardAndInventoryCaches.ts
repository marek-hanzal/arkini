import type { QueryClient } from "@tanstack/react-query";
import { refreshBoardViewCache } from "~/v0/board/cache/refreshBoardViewCache";
import { refreshDatabaseStatusCache } from "~/v0/database/cache/refreshDatabaseStatusCache";
import { refreshInventoryViewCache } from "~/v0/inventory/cache/refreshInventoryViewCache";

export namespace refreshBoardAndInventoryCaches {
	export interface Props {
		queryClient: QueryClient;
	}
}

export const refreshBoardAndInventoryCaches = async ({
	queryClient,
}: refreshBoardAndInventoryCaches.Props) => {
	await Promise.all([
		refreshBoardViewCache({
			queryClient,
		}),
		refreshInventoryViewCache({
			queryClient,
		}),
		refreshDatabaseStatusCache({
			queryClient,
		}),
	]);
};
