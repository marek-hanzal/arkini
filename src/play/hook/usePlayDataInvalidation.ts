import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { databaseStatusQueryKey } from "./databaseStatusQueryKey";
import { playQueryKeys } from "./playQueryKeys";

export function usePlayDataInvalidation() {
	const queryClient = useQueryClient();

	return useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: playQueryKeys.all,
			}),
			queryClient.invalidateQueries({
				queryKey: databaseStatusQueryKey,
			}),
		]);
	}, [
		queryClient,
	]);
}
