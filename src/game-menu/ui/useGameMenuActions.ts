import { useAtom } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Cause, Exit, Option } from "effect";
import { useEffect, useState } from "react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import type { Game } from "~/installed-game/type/Game";
import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";
import type { GameMenuAction, GameMenuPhase } from "~/game-menu/type/GameMenuControl";
import { gameMenuCommandAtom } from "~/game-menu/atom/gameMenuCommandAtom";
import { useGameMenuControl } from "~/game-menu/ui/GameMenuProvider";

const errorMessageFn = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Orchestrates menu intent without taking Game lifecycle ownership. Local save
 * remains an exact-Game command; save-and-exit requests the application
 * close handshake; leave/reset delegate resource mutation to action-route
 * loaders; settings/cheats are navigation only. The action claim serializes
 * these paths until their command or navigation request settles.
 */
export const useGameMenuActions = ({
	game,
	phase,
}: {
	readonly game: Game;
	readonly phase: Exclude<GameMenuPhase, "closed">;
}) => {
	const menu = useGameMenuControl();
	const navigateFn = useNavigate();
	const commandAtom = gameMenuCommandAtom(game);
	const [commandResult, runCommandFn] = useAtom(commandAtom);
	const [confirmingDestroy, setConfirmingDestroyFn] = useState(false);
	const [navigationError, setNavigationErrorFn] = useState<unknown>();
	const savePending = menu.activeAction === "save";
	const saveAndExitPending = menu.activeAction === "save-and-exit";
	const pending = menu.activeAction !== null || commandResult.waiting;
	const actionDisabled = phase !== "open" || pending;
	if (AsyncResult.isFailure(commandResult) && !commandResult.waiting) {
		throw commandResult.cause;
	}
	const settledCommand =
		AsyncResult.isSuccess(commandResult) && !commandResult.waiting
			? commandResult.value
			: undefined;
	const commandFailure = (() => {
		if (settledCommand === undefined || Exit.isSuccess(settledCommand.exit)) return undefined;
		if (Cause.hasInterruptsOnly(settledCommand.exit.cause)) {
			throw settledCommand.exit.cause;
		}
		const failure = readExactCauseFailureFn(settledCommand.exit.cause);
		if (Option.isNone(failure)) {
			game.failStopFn("ui", settledCommand.exit.cause);
			throw settledCommand.exit.cause;
		}
		return {
			command: settledCommand.command,
			error: failure.value,
		};
	})();
	const successfulCommand =
		settledCommand !== undefined && Exit.isSuccess(settledCommand.exit)
			? settledCommand.command
			: undefined;

	useEffect(
		() => () => {
			menu.completeActionFn("save");
			menu.completeActionFn("save-and-exit");
		},
		[
			commandAtom,
			menu.completeActionFn,
		],
	);

	useEffect(() => {
		if (
			(menu.activeAction !== "save" && menu.activeAction !== "save-and-exit") ||
			commandResult.waiting ||
			AsyncResult.isInitial(commandResult)
		) {
			return;
		}
		menu.completeActionFn(menu.activeAction);
	}, [
		commandResult,
		menu.activeAction,
		menu.completeActionFn,
	]);

	const requestNavigationFn = (
		action: Exclude<GameMenuAction, "save" | "save-and-exit">,
		requestFn: () => Promise<unknown>,
	) => {
		if (!menu.beginActionFn(action)) return;
		setNavigationErrorFn(undefined);
		void requestFn()
			.catch(setNavigationErrorFn)
			.finally(() => {
				menu.completeActionFn(action);
			});
	};

	const requestSettingsFn = () =>
		requestNavigationFn("settings", () =>
			navigateFn({
				to: "/settings",
			}),
		);

	const requestCheatsFn = () =>
		requestNavigationFn("cheats", () =>
			navigateFn({
				to: "/game/$packageId/cheats",
				params: {
					packageId: game.arkpack.packageId,
				},
			}),
		);

	const requestMainMenuFn = () =>
		requestNavigationFn("main-menu", () =>
			navigateFn({
				to: "/game/$packageId/action/leave",
				params: {
					packageId: game.arkpack.packageId,
				},
				search: {
					destination: "main-menu",
				},
			}),
		);

	const requestSaveFn = () => {
		if (!menu.beginActionFn("save")) return;
		runCommandFn("save");
	};

	const requestSaveAndExitFn = () => {
		if (!menu.beginActionFn("save-and-exit")) return;
		runCommandFn("save-and-exit");
	};

	const requestHardResetFn = () =>
		requestNavigationFn("hard-reset", () =>
			navigateFn({
				to: "/game/$packageId/action/reset",
				params: {
					packageId: game.arkpack.packageId,
				},
			}),
		);

	const status = (() => {
		if (saveAndExitPending) return "Saving and exiting Arkini…";
		if (savePending) return "Saving…";
		if (commandFailure !== undefined) {
			const label = commandFailure.command === "save-and-exit" ? "Save and exit" : "Save";
			return `${label} failed: ${errorMessageFn(commandFailure.error)}`;
		}
		if (navigationError !== undefined) {
			return `Navigation failed: ${errorMessageFn(navigationError)}`;
		}
		if (
			menu.activeAction === "settings" ||
			menu.activeAction === "cheats" ||
			menu.activeAction === "main-menu" ||
			menu.activeAction === "hard-reset"
		) {
			return "Opening action page…";
		}
		if (successfulCommand === "save-and-exit") return "Save and exit requested.";
		if (successfulCommand === "save") return "Saved.";
		return null;
	})();

	return {
		status,
		pending,
		actionDisabled,
		confirmingDestroy,
		setConfirmingDestroyFn,
		closeFn: menu.closeFn,
		requestSettingsFn,
		requestCheatsFn,
		requestMainMenuFn,
		requestSaveFn,
		requestSaveAndExitFn,
		requestHardResetFn,
	};
};
