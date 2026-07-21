import { useNavigate } from "@tanstack/react-router";
import type { Game } from "~/bridge/game/Game";
import { useRef, useState } from "react";
import { match, P } from "ts-pattern";

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
	const activeRequestRef = useRef<ActiveRequest | null>(null);
	const pending = save.isPending || saveAndExit.isPending || menu.routePending;
	const actionDisabled = phase !== "open" || pending;

	const requestSettings = () => {
		if (activeRequestRef.current !== null || !menu.beginRouteRequest()) return;
		activeRequestRef.current = "settings";
		setNavigationError(undefined);
		void navigate({
			to: "/settings",
		})
			.catch(setNavigationError)
			.finally(() => {
				activeRequestRef.current = null;
				menu.completeRouteRequest();
			});
	};

	const requestCheats = () => {
		if (activeRequestRef.current !== null || !menu.beginRouteRequest()) return;
		activeRequestRef.current = "cheats";
		setNavigationError(undefined);
		void navigate({
			to: "/game/$packageId/cheats",
			params: {
				packageId: game.arkpack.packageId,
			},
		})
			.catch(setNavigationError)
			.finally(() => {
				activeRequestRef.current = null;
				menu.completeRouteRequest();
			});
	};

	const requestMainMenu = () => {
		if (activeRequestRef.current !== null || !menu.beginRouteRequest()) return;
		activeRequestRef.current = "main-menu";
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
				activeRequestRef.current = null;
				menu.completeRouteRequest();
			});
	};

	const requestSave = () => {
		if (phase !== "open" || menu.routePending || activeRequestRef.current !== null) return;
		activeRequestRef.current = "save";
		save.mutate(undefined, {
			onSettled: () => {
				activeRequestRef.current = null;
			},
		});
	};

	const requestSaveAndExit = () => {
		if (phase !== "open" || menu.routePending || activeRequestRef.current !== null) return;
		activeRequestRef.current = "save-and-exit";
		saveAndExit.mutate(undefined, {
			onSettled: () => {
				activeRequestRef.current = null;
			},
		});
	};

	const requestHardReset = () => {
		if (activeRequestRef.current !== null || !menu.beginRouteRequest()) return;
		activeRequestRef.current = "hard-reset";
		setNavigationError(undefined);
		void navigate({
			to: "/game/$packageId/action/reset",
			params: {
				packageId: game.arkpack.packageId,
			},
		})
			.catch(setNavigationError)
			.finally(() => {
				activeRequestRef.current = null;
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
