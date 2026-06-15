import { useSuspenseQuery } from "@tanstack/react-query";
import type { GameSaveView } from "~/play/view/GameSaveViewSchema";
import { loadPlayBackend } from "./loadPlayBackend";
import { playQueryKeys } from "./playQueryKeys";

export function usePlaySave(): GameSaveView {
	return useSuspenseQuery({
		queryKey: playQueryKeys.save,
		async queryFn() {
			const db = await loadPlayBackend();
			return db.readGameSaveView();
		},
	}).data;
}
