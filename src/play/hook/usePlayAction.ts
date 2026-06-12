import { useMutation } from "@tanstack/react-query";
import { loadPlayBackend } from "./loadPlayBackend";
import { usePlayDataInvalidation } from "./usePlayDataInvalidation";

export function usePlayAction<TVariables, TResult = void>(
	action: (
		db: typeof import("~/play/logic/playBackend"),
		variables: TVariables,
	) => Promise<TResult>,
	options: usePlayAction.Options = {},
) {
	const invalidatePlayData = usePlayDataInvalidation();

	return useMutation({
		async mutationFn(variables: TVariables) {
			const db = await loadPlayBackend();
			return action(db, variables);
		},
		async onSuccess() {
			if (options.invalidateOnSuccess === false) return;
			await invalidatePlayData();
		},
	});
}

export namespace usePlayAction {
	export interface Options {
		invalidateOnSuccess?: boolean;
	}
}
