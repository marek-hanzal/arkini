import { useHotkey } from "@tanstack/react-hotkeys";
import { Exit } from "effect";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { match, P } from "ts-pattern";

import { useGameCheats } from "~/game-cheat/ui/useGameCheats";
import type { PlayableGame } from "~/playable-game/type/PlayableGame";
import { useCheatAvailability } from "~/application-settings/ui/useCheatAvailability";
import { CheatItemSpawnContext } from "~/game-cheat/context/CheatItemSpawnContext";
import { useGameMenuControl } from "~/game-menu/ui/GameMenuProvider";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import { readCheatItemCatalogFx } from "~/game-cheat/fx/readCheatItemCatalogFx";

const errorMessageFn = (error: unknown) =>
	match(error)
		.with(P.instanceOf(Error), (current) => current.message)
		.otherwise(String);

export namespace useCheatItemSpotlightController {
	export interface Item {
		readonly compositeUrl?: string;
		readonly itemId: string;
		readonly sourceUrl: string;
		readonly title: string;
	}

	export interface Props {
		readonly alwaysAvailable?: boolean;
		readonly game: PlayableGame;
		readonly onBeforeOpenFn?: () => void;
	}

	export interface Output {
		readonly closeFn: () => void;
		readonly items: ReadonlyArray<Item>;
		readonly open: boolean;
		readonly resetSpawnStatusFn: () => void;
		readonly selectItemFn: (itemId: string) => void;
		readonly spawnStatus: "error" | "idle" | "pending" | "success";
		readonly spawnStatusMessage: string;
	}
}

export const useCheatItemSpotlightController = ({
	alwaysAvailable = false,
	game,
	onBeforeOpenFn,
}: useCheatItemSpotlightController.Props): useCheatItemSpotlightController.Output => {
	const cheats = useGameCheats(game);
	const cheatAvailability = useCheatAvailability();
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();
	const spawn = use(CheatItemSpawnContext);
	if (spawn === null) throw new Error("CheatItemSpawnProvider is not mounted.");
	const items = useMemo(() => {
		const exit = game.readFn(readCheatItemCatalogFx());
		if (Exit.isFailure(exit)) throw exit.cause;
		return exit.value.map(({ itemId, sourceResourceIds, title }) => ({
			...(sourceResourceIds[1] === undefined
				? {}
				: {
						compositeUrl: game.getResourceUrlFn(sourceResourceIds[1]),
					}),
			itemId,
			sourceUrl: game.getResourceUrlFn(sourceResourceIds[0]),
			title,
		}));
	}, [
		game,
	]);
	const preserveSpawnOutcomeRef = useRef(false);
	const [open, setOpenFn] = useState(false);
	const blockedByHigherOwner = gameMenu.phase !== "closed" || itemDetail.state.phase !== "closed";
	const admitted = alwaysAvailable || cheatAvailability.available;
	const available = admitted && cheats.enabled && !blockedByHigherOwner;
	const closeFn = useCallback(() => {
		if (spawn.pending) preserveSpawnOutcomeRef.current = true;
		setOpenFn(false);
	}, [
		spawn.pending,
	]);
	const toggleFn = () => {
		if (open) {
			closeFn();
			return;
		}
		if (!available) return;
		onBeforeOpenFn?.();
		match({
			preserveSpawnOutcome: preserveSpawnOutcomeRef.current,
			spawnPending: spawn.pending,
		})
			.with(
				{
					preserveSpawnOutcome: true,
				},
				() => {
					preserveSpawnOutcomeRef.current = false;
				},
			)
			.with(
				{
					preserveSpawnOutcome: false,
					spawnPending: false,
				},
				spawn.resetFn,
			)
			.with(
				{
					preserveSpawnOutcome: false,
					spawnPending: true,
				},
				() => undefined,
			)
			.exhaustive();
		setOpenFn(true);
	};
	const selectItemFn = (itemId: string) => {
		spawn.requestFn(itemId);
	};

	useHotkey("Mod+P", toggleFn, {
		enabled: admitted && cheats.enabled,
		preventDefault: true,
	});

	useEffect(() => {
		if (!open) return;
		if (blockedByHigherOwner || !admitted || !cheats.enabled) closeFn();
	}, [
		admitted,
		blockedByHigherOwner,
		cheats.enabled,
		closeFn,
		open,
	]);

	const spawnStatus = spawn.state.kind;
	const spawnStatusMessage = match(spawn.state)
		.with(
			{
				kind: "pending",
			},
			() => "Spawning…",
		)
		.with(
			{
				kind: "error",
			},
			({ error }) => `Spawn failed: ${errorMessageFn(error)}`,
		)
		.with(
			{
				kind: "success",
			},
			() => "Item spawned.",
		)
		.with(
			{
				kind: "idle",
			},
			() => "↑↓ select · Enter spawn · Esc close",
		)
		.exhaustive();

	return {
		closeFn,
		items,
		open,
		resetSpawnStatusFn: spawn.resetFn,
		selectItemFn,
		spawnStatus,
		spawnStatusMessage,
	};
};
