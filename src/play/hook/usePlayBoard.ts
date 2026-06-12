import { useQuery } from "@tanstack/react-query";
import { loadPlayBackend } from "./loadPlayBackend";
import { playQueryKeys } from "./playQueryKeys";

export function usePlayBoard() {
	return useQuery({
		queryKey: playQueryKeys.board,
		enabled: typeof window !== "undefined",
		async queryFn() {
			const db = await loadPlayBackend();
			return db.readBoardView();
		},
	});
}
