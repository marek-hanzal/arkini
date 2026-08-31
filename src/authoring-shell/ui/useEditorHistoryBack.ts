import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

/** Uses the real browser entry and falls back only for a direct editor deep link. */
export const useEditorHistoryBack = () => {
	const router = useRouter();
	return useCallback(
		(onFallbackFn: () => void) => {
			if (router.history.canGoBack()) {
				router.history.back();
				return true;
			}
			onFallbackFn();
			return false;
		},
		[
			router,
		],
	);
};
