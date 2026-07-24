import { useNavigate } from "@tanstack/react-router";
import type { Game } from "~/bridge/game/Game";
import { useState } from "react";
import { match, P } from "ts-pattern";

import { useExclusiveAction } from "~/ui/action/useExclusiveAction";
import type { GameMenuPhase } from "~/ui/game-menu/GameMenuControl";
import { useSaveAndExitGameMutation } from "~/ui/game-menu/mutation/useSaveAndExitGameMutation";
import { useSaveGameMutation } from "~/ui/game-menu/mutation/useSaveGameMutation";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";

type ActiveRequest = "save" | "save-and-exit" | "hard-reset" | "main-menu" | "settings" | "cheats";

type NavigationState =
	| {
			readonly kind: "idle";
	  }
	| {
			readonly kind: "error";
			readonly error: unknown;
	  };

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Owns GameMenu mutations, route requests, destructive confirmation, and status projection. */
export const useGameMenuActions = ({
	game,
	phase,
}: {
	readonly game: Game;
	readonly phase: Exclude<GameMenuPhase, "closed">;
}) => {
	const menu = useGameMenuControl();
	const navigate = useNavigate();
	const save = useSaveGameMutation(game);
	const saveAndExit = useSaveAndExitGameMutation(game);
	const [confirmingDestroy, setConfirmingDestroy] = useState(false);
	const [navigationError, setNavigationError] = useState<unknown>();
	const request = useExclusiveAction<ActiveRequest>();
	const pending =
		request.active !== null || save.isPending || saveAndExit.isPending || menu.routePending;
	const actionDisabled = phase !== "open" || pending;

	const requestSettings = () => {
		if (!request.claim("settings")) return;
		if (!menu.beginRouteRequest()) {
			request.release("settings");
			return;
		}
		setNavigationError(undefined);
		void navigate({
			to: "/settings",
		})
			.catch(setNavigationError)
			.finally(() => {
				request.release("settings");
				menu.completeRouteRequest();
			});
	};

	const requestCheats = () => {
		if (!request.claim("cheats")) return;
		if (!menu.beginRouteRequest()) {
			request.release("cheats");
			return;
		}
		setNavigationError(undefined);
		void navigate({
			to: "/game/$packageId/cheats",
			params: {
				packageId: game.arkpack.packageId,
			},
		})
			.catch(setNavigationError)
			.finally(() => {
				request.release("cheats");
				menu.completeRouteRequest();
			});
	};

	const requestMainMenu = () => {
		if (!request.claim("main-menu")) return;
		if (!menu.beginRouteRequest()) {
			request.release("main-menu");
			return;
		}
		setNavigationError(undefined);
		void navigate({
			to: "/game/$packageId/action/leave",
			params: {
				packageId: game.arkpack.packageId,
			},
			search: {
				destination: "main-menu",
			},
		})
			.catch(setNavigationError)
			.finally(() => {
				request.release("main-menu");
				menu.completeRouteRequest();
			});
	};

	const requestSave = () => {
		if (phase !== "open" || menu.routePending || !request.claim("save")) return;
		save.mutate(undefined, {
			onSettled: () => {
				request.release("save");
			},
		});
	};

	const requestSaveAndExit = () => {
		if (phase !== "open" || menu.routePending || !request.claim("save-and-exit")) return;
		saveAndExit.mutate(undefined, {
			onSettled: () => {
				request.release("save-and-exit");
			},
		});
	};

	const requestHardReset = () => {
		if (!request.claim("hard-reset")) return;
		if (!menu.beginRouteRequest()) {
			request.release("hard-reset");
			return;
		}
		setNavigationError(undefined);
		void navigate({
			to: "/game/$packageId/action/reset",
			params: {
				packageId: game.arkpack.packageId,
			},
		})
			.catch(setNavigationError)
			.finally(() => {
				request.release("hard-reset");
				menu.completeRouteRequest();
			});
	};

	const navigation: NavigationState =
		navigationError === undefined
			? {
					kind: "idle",
				}
			: {
					kind: "error",
					error: navigationError,
				};
	const status = match([
		saveAndExit.status,
		save.status,
		navigation,
		menu.routePending,
	] as const)
		.with(
			[
				"pending",
				P._,
				P._,
				P._,
			],
			() => "Saving and exiting Arkini…",
		)
		.with(
			[
				P._,
				"pending",
				P._,
				P._,
			],
			() => "Saving…",
		)
		.with(
			[
				"error",
				P._,
				P._,
				P._,
			],
			() => `Save and exit failed: ${errorMessage(saveAndExit.error)}`,
		)
		.with(
			[
				P._,
				"error",
				P._,
				P._,
			],
			() => `Save failed: ${errorMessage(save.error)}`,
		)
		.with(
			[
				P._,
				P._,
				{
					kind: "error",
				},
				P._,
			],
			([, , failed]) => `Navigation failed: ${errorMessage(failed.error)}`,
		)
		.with(
			[
				P._,
				P._,
				{
					kind: "idle",
				},
				true,
			],
			() => "Opening action page…",
		)
		.with(
			[
				P._,
				"success",
				{
					kind: "idle",
				},
				false,
			],
			() => "Saved.",
		)
		.with(P._, () => null)
		.exhaustive();

	return {
		status,
		pending,
		actionDisabled,
		confirmingDestroy,
		setConfirmingDestroy,
		close: menu.close,
		requestSettings,
		requestCheats,
		requestMainMenu,
		requestSave,
		requestSaveAndExit,
		requestHardReset,
	};
};
