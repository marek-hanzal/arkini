import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PlayDataInvalidationTarget } from "./PlayDataInvalidationTarget";
import { queryKeyForTarget } from "./queryKeyForTarget";

export type { PlayDataInvalidationTarget } from "./PlayDataInvalidationTarget";

export const usePlayDataInvalidation = () => {
	const queryClient = useQueryClient();

	return useCallback(
		async (
			targets: readonly PlayDataInvalidationTarget[] = [
				"all",
				"databaseStatus",
			],
		) => {
			await Promise.all(
				targets.map((target) =>
					queryClient.invalidateQueries({
						queryKey: queryKeyForTarget(target),
					}),
				),
			);
		},
		[
			queryClient,
		],
	);
};
