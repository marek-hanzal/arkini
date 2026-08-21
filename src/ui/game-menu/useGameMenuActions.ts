import { useAtom } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Cause, Exit, Option } from "effect";
import { useEffect, useState } from "react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import type { Game } from "~/bridge/game/Game";
import { readExactCauseFailureFx } from "~/bridge/game/readExactCauseFailureFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { GameMenuAction, GameMenuPhase } from "~/ui/game-menu/GameMenuControl";
import { gameMenuCommandAtom } from "~/ui/game-menu/gameMenuCommandAtom";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Orchestrates menu intent without taking Game lifecycle ownership. Local save
 * remains an exact-Game bridge command; save-and-exit requests the application
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
	const navigate = useNavigate();
	const commandAtom = gameMenuCommandAtom(game);
	const [commandResult, runCommand] = useAtom(commandAtom);
	const [confirmingDestroy, setConfirmingDestroy] = useState(false);
	const [navigationError, setNavigationError] = useState<unknown>();
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
		const failure = RendererRuntime.runSync(readExactCauseFailureFx(settledCommand.exit.cause));
		if (Option.isNone(failure)) {
			game.failStop("ui", settledCommand.exit.cause);
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
			menu.completeAction("save");
			menu.completeAction("save-and-exit");
		},
		[
			commandAtom,
			menu.completeAction,
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
		menu.completeAction(menu.activeAction);
	}, [
		commandResult,
		menu.activeAction,
		menu.completeAction,
	]);

	const requestNavigation = (
		action: Exclude<GameMenuAction, "save" | "save-and-exit">,
		request: () => Promise<unknown>,
	) => {
		if (!menu.beginAction(action)) return;
		setNavigationError(undefined);
		void request()
			.catch(setNavigationError)
			.finally(() => {
				menu.completeAction(action);
			});
	};

	const requestSettings = () =>
		requestNavigation("settings", () =>
			navigate({
				to: "/settings",
			}),
		);

	const requestCheats = () =>
		requestNavigation("cheats", () =>
			navigate({
				to: "/game/$packageId/cheats",
				params: {
					packageId: game.arkpack.packageId,
				},
			}),
		);

	const requestMainMenu = () =>
		requestNavigation("main-menu", () =>
			navigate({
				to: "/game/$packageId/action/leave",
				params: {
					packageId: game.arkpack.packageId,
				},
				search: {
					destination: "main-menu",
				},
			}),
		);

	const requestSave = () => {
		if (!menu.beginAction("save")) return;
		runCommand("save");
	};

	const requestSaveAndExit = () => {
		if (!menu.beginAction("save-and-exit")) return;
		runCommand("save-and-exit");
	};

	const requestHardReset = () =>
		requestNavigation("hard-reset", () =>
			navigate({
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
			return `${label} failed: ${errorMessage(commandFailure.error)}`;
		}
		if (navigationError !== undefined) {
			return `Navigation failed: ${errorMessage(navigationError)}`;
		}
		if (menu.routePending) return "Opening action page…";
		if (successfulCommand === "save-and-exit") return "Save and exit requested.";
		if (successfulCommand === "save") return "Saved.";
		return null;
	})();

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
