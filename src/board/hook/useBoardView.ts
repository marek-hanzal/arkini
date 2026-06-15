import { useQuery } from "@tanstack/react-query";
import { loadPlayBackend } from "~/play/hook/loadPlayBackend";
import { playQueryKeys } from "~/play/hook/playQueryKeys";

export function useBoardView() {
	return useQuery({
		queryKey: playQueryKeys.board,
		enabled: typeof window !== "undefined",
		async queryFn() {
			const db = await loadPlayBackend();
			return db.readBoardView();
		},
	});
}
