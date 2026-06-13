import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { databaseStatusQueryKey } from "./databaseStatusQueryKey";
import { playQueryKeys } from "./playQueryKeys";

export type PlayDataInvalidationTarget =
	| "all"
	| "save"
	| "items"
	| "board"
	| "inventory"
	| "buildRecipes"
	| "playerInventory"
	| "databaseStatus";

export function usePlayDataInvalidation() {
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
}

function queryKeyForTarget(target: PlayDataInvalidationTarget) {
	switch (target) {
		case "all":
			return playQueryKeys.all;
		case "save":
			return playQueryKeys.save;
		case "items":
			return playQueryKeys.items;
		case "board":
			return playQueryKeys.board;
		case "inventory":
			return playQueryKeys.inventory;
		case "buildRecipes":
			return playQueryKeys.buildRecipes;
		case "playerInventory":
			return playQueryKeys.playerInventory;
		case "databaseStatus":
			return databaseStatusQueryKey;
	}
}
