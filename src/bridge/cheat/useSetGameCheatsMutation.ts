import { useMutation } from "@tanstack/react-query";
import { match } from "ts-pattern";

import type { Game } from "~/bridge/game/Game";
import { setCheatEnabledFx } from "~/engine/cheat/write/setCheatEnabledFx";
import { setInstantGameplayFx } from "~/engine/cheat/write/setInstantGameplayFx";

export namespace useSetGameCheatsMutation {
	export type Action = "cheat-mode" | "instant-gameplay";

	export interface Command {
		readonly action: Action;
		readonly enabled: boolean;
	}
}

/** Mutates either save-scoped Cheat setting through one authoritative observer. */
export const useSetGameCheatsMutation = (game: Game) =>
	useMutation({
		mutationKey: [
			"game",
			"cheats",
			"settings",
			game.saveKey.packageId,
			game.saveKey.contentHash,
		],
		mutationFn: ({ action, enabled }: useSetGameCheatsMutation.Command) =>
			match(action)
				.with("cheat-mode", () =>
					game.run(
						setCheatEnabledFx({
							enabled,
						}),
					),
				)
				.with("instant-gameplay", () =>
					game.run(
						setInstantGameplayFx({
							enabled,
						}),
					),
				)
				.exhaustive(),
		retry: false,
	});
