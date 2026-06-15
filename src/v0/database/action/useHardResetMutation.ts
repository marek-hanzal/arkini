import { useMutation } from "@tanstack/react-query";
import { hardResetBrowserStorageFx } from "~/v0/database/fx/hardResetBrowserStorageFx";
import { runGameFx } from "~/v0/fx/runGameFx";

export const useHardResetMutation = () =>
	useMutation<void, unknown, void>({
		mutationFn: async () =>
			runGameFx({
				effect: hardResetBrowserStorageFx,
			}),
		onSuccess: () => window.location.reload(),
		onError: (error) => console.error(error),
	});
