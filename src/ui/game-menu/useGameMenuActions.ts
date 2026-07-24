import { useNavigate } from "@tanstack/react-router";
import type { Game } from "~/bridge/game/Game";
import { useState } from "react";
import { match, P } from "ts-pattern";

import type { GameMenuPhase } from "~/ui/game-menu/GameMenuControl";
import { useSaveAndExitGameMutation } from "~/ui/game-menu/mutation/useSaveAndExitGameMutation";
import { useSaveGameMutation } from "~/ui/game-menu/mutation/useSaveGameMutation";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";

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
	const pending = menu.activeAction !== null || save.isPending || saveAndExit.isPending;
	const actionDisabled = phase !== "open" || pending;

	const requestSettings = () => {
		if (!menu.beginAction("settings")) return;
		setNavigationError(undefined);
		void navigate({
			to: "/settings",
		})
			.catch(setNavigationError)
			.finally(() => {
				menu.completeAction("settings");
			});
	};

	const requestCheats = () => {
		if (!menu.beginAction("cheats")) return;
		setNavigationError(undefined);
		void navigate({
			to: "/game/$packageId/cheats",
			params: {
				packageId: game.arkpack.packageId,
			},
		})
			.catch(setNavigationError)
			.finally(() => {
				menu.completeAction("cheats");
			});
	};

	const requestMainMenu = () => {
		if (!menu.beginAction("main-menu")) return;
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
				menu.completeAction("main-menu");
			});
	};

	const requestSave = () => {
		if (!menu.beginAction("save")) return;
		void save.mutateAsync().then(
			() => menu.completeAction("save"),
			() => menu.completeAction("save"),
		);
	};

	const requestSaveAndExit = () => {
		if (!menu.beginAction("save-and-exit")) return;
		void saveAndExit.mutateAsync().then(
			() => menu.completeAction("save-and-exit"),
			() => menu.completeAction("save-and-exit"),
		);
	};

	const requestHardReset = () => {
		if (!menu.beginAction("hard-reset")) return;
		setNavigationError(undefined);
		void navigate({
			to: "/game/$packageId/action/reset",
			params: {
				packageId: game.arkpack.packageId,
			},
		})
			.catch(setNavigationError)
			.finally(() => {
				menu.completeAction("hard-reset");
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
