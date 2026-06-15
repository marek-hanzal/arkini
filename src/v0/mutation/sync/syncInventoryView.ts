import type { QueryClient } from "@tanstack/react-query";
import { loadPlayBackend } from "~/v0/query/loadPlayBackend";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export namespace syncInventoryView {
	export interface Props {
		queryClient: QueryClient;
	}
}

export const syncInventoryView = async ({ queryClient }: syncInventoryView.Props) => {
	const db = await loadPlayBackend();
	queryClient.setQueryData(playQueryKeys.inventory, await db.readInventoryView());
};
