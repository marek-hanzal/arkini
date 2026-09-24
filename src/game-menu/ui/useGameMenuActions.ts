import { match, P } from "ts-pattern";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { GameSaveSlotSchema } from "~/game-persistence/schema/GameSaveSlotSchema";
import { useAtom } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Cause, Exit, Option } from "effect";
import { useEffect, useRef, useState } from "react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import type { Game } from "~/installed-game/type/Game";
import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";
import type { GameMenuAction, GameMenuPhase } from "~/game-menu/type/GameMenuControl";
import { gameMenuCommandAtom } from "~/game-menu/atom/gameMenuCommandAtom";
import { useGameMenuControl } from "~/game-menu/ui/GameMenuProvider";

const errorMessageFn = (error: unknown) => (error instanceof Error ? error.message : String(error));

export namespace useGameMenuActions {
	export interface Output {
		readonly status: string | null;
		readonly pending: boolean;
		readonly actionDisabled: boolean;
		readonly confirmingReset: boolean;
		readonly setConfirmingResetFn: (value: boolean) => void;
		readonly closeFn: () => void;
		readonly requestSettingsFn: () => void;
		readonly requestCheatsFn: () => void;
		readonly requestMainMenuFn: () => void;
		readonly requestSaveFn: () => void;
		readonly requestLoadFn: (slot: GameSaveSlotSchema.Type) => void;
		readonly requestSaveAndExitFn: () => void;
		readonly requestHardResetFn: () => void;
	}
}

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
	readonly phase: GameMenuPhase;
}): useGameMenuActions.Output => {
	const menu = useGameMenuControl();
	const ownerRef = useRef<object | null>(null);
	useEffect(() => {
		ownerRef.current = {};
		return () => {
			ownerRef.current = null;
		};
	}, [
		game,
	]);
	const navigateFn = useNavigate();
	const commandAtom = gameMenuCommandAtom(game);
	const [commandResult, runCommandFn] = useAtom(commandAtom);
	const [confirmingReset, setConfirmingResetFn] = useState(false);
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
					packageId: game.serapack.packageId,
				},
			}),
		);

	const requestMainMenuFn = () =>
		requestNavigationFn("main-menu", () =>
			navigateFn({
				to: "/game/$packageId/action/leave",
				params: {
					packageId: game.serapack.packageId,
				},
				search: {
					destination: "main-menu",
				},
			}),
		);

	const requestLoadFn = (slot: GameSaveSlotSchema.Type) =>
		requestNavigationFn("load", async () => {
			const owner = ownerRef.current;
			const saves = await RendererRuntime.runPromise(game.listSavesFx);
			if (owner === null || ownerRef.current !== owner) return;
			if (!saves.some((save) => save.slot === slot && save.savedAt !== null)) {
				return;
			}
			return navigateFn({
				to: "/game/$packageId/action/load",
				params: {
					packageId: game.serapack.packageId,
				},
				search: {
					slot,
				},
			});
		});

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
					packageId: game.serapack.packageId,
				},
			}),
		);

	useEffect(() => {
		const onKeyDownFn = (event: KeyboardEvent) => {
			if (event.key !== "F5" && event.key !== "F9") return;
			if (
				event.defaultPrevented ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey
			)
				return;
			event.preventDefault();
			if (event.repeat || pending || (phase !== "closed" && phase !== "open")) return;
			if (event.key === "F5") requestSaveFn();
			else requestLoadFn("manual");
		};
		window.addEventListener("keydown", onKeyDownFn);
		return () => window.removeEventListener("keydown", onKeyDownFn);
	});

	const status = match({
		saveAndExitPending,
		savePending,
		commandFailure,
		navigationError,
		activeAction: menu.activeAction,
		successfulCommand,
	})
		.with(
			{
				saveAndExitPending: true,
			},
			() => "Saving and exiting Serakki…",
		)
		.with(
			{
				savePending: true,
			},
			() => "Saving…",
		)
		.with(
			{
				commandFailure: P.nonNullable,
			},
			({ commandFailure }) => {
				const label = commandFailure.command === "save-and-exit" ? "Save and exit" : "Save";
				return `${label} failed: ${errorMessageFn(commandFailure.error)}`;
			},
		)
		.with(
			{
				navigationError: P.not(undefined),
			},
			({ navigationError }) => `Navigation failed: ${errorMessageFn(navigationError)}`,
		)
		.with(
			{
				activeAction: "load",
			},
			() => null,
		)
		.with(
			{
				activeAction: P.union("settings", "cheats", "main-menu", "hard-reset"),
			},
			() => "Opening action page…",
		)
		.with(
			{
				successfulCommand: "save-and-exit",
			},
			() => "Save and exit requested.",
		)
		.with(
			{
				successfulCommand: "save",
			},
			() => "Saved.",
		)
		.otherwise(() => null);

	return {
		status,
		pending,
		actionDisabled,
		confirmingReset,
		setConfirmingResetFn,
		closeFn: menu.closeFn,
		requestSettingsFn,
		requestCheatsFn,
		requestMainMenuFn,
		requestSaveFn,
		requestLoadFn,
		requestSaveAndExitFn,
		requestHardResetFn,
	};
};
