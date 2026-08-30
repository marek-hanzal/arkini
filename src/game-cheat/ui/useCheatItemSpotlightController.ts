import { useHotkey } from "@tanstack/react-hotkeys";
import { Exit } from "effect";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { match, P } from "ts-pattern";

import { useGameCheats } from "~/game-cheat/ui/useGameCheats";
import type { PlayableGame } from "~/renderer/game/PlayableGame";
import { useCheatAvailability } from "~/application-settings/ui/useCheatAvailability";
import { CheatItemSpawnContext } from "~/game-cheat/context/CheatItemSpawnContext";
import { useGameMenuControl } from "~/game-menu/ui/GameMenuProvider";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import { readCheatItemCatalogFx } from "~/engine/cheat/read/readCheatItemCatalogFx";

const errorMessage = (error: unknown) =>
	match(error)
		.with(P.instanceOf(Error), (current) => current.message)
		.otherwise(String);

export namespace useCheatItemSpotlightController {
	export interface Item {
		readonly itemId: string;
		readonly sourceUrl: string;
		readonly title: string;
	}

	export interface Props {
		readonly alwaysAvailable?: boolean;
		readonly game: PlayableGame;
		readonly onBeforeOpen?: () => void;
	}

	export interface Output {
		readonly close: () => void;
		readonly items: ReadonlyArray<Item>;
		readonly open: boolean;
		readonly resetSpawnStatus: () => void;
		readonly selectItem: (itemId: string) => void;
		readonly spawnStatus: "error" | "idle" | "pending" | "success";
		readonly spawnStatusMessage: string;
	}
}

export const useCheatItemSpotlightController = ({
	alwaysAvailable = false,
	game,
	onBeforeOpen,
}: useCheatItemSpotlightController.Props): useCheatItemSpotlightController.Output => {
	const cheats = useGameCheats(game);
	const cheatAvailability = useCheatAvailability();
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();
	const spawn = use(CheatItemSpawnContext);
	if (spawn === null) throw new Error("CheatItemSpawnProvider is not mounted.");
	const items = useMemo(() => {
		const exit = game.read(readCheatItemCatalogFx());
		if (Exit.isFailure(exit)) throw exit.cause;
		return exit.value.map(({ itemId, sourceResourceId, title }) => ({
			itemId,
			sourceUrl: game.getResourceUrl(sourceResourceId),
			title,
		}));
	}, [
		game,
	]);
	const preserveSpawnOutcomeRef = useRef(false);
	const [open, setOpen] = useState(false);
	const blockedByHigherOwner = gameMenu.phase !== "closed" || itemDetail.state.phase !== "closed";
	const admitted = alwaysAvailable || cheatAvailability.available;
	const available = admitted && cheats.enabled && !blockedByHigherOwner;
	const close = useCallback(() => {
		if (spawn.pending) preserveSpawnOutcomeRef.current = true;
		setOpen(false);
	}, [
		spawn.pending,
	]);
	const toggle = () => {
		if (open) {
			close();
			return;
		}
		if (!available) return;
		onBeforeOpen?.();
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
				spawn.reset,
			)
			.with(
				{
					preserveSpawnOutcome: false,
					spawnPending: true,
				},
				() => undefined,
			)
			.exhaustive();
		setOpen(true);
	};
	const selectItem = (itemId: string) => {
		spawn.request(itemId);
	};

	useHotkey("Mod+P", toggle, {
		enabled: admitted && cheats.enabled,
		preventDefault: true,
	});

	useEffect(() => {
		if (!open) return;
		if (blockedByHigherOwner || !admitted || !cheats.enabled) close();
	}, [
		admitted,
		blockedByHigherOwner,
		cheats.enabled,
		close,
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
			({ error }) => `Spawn failed: ${errorMessage(error)}`,
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
		close,
		items,
		open,
		resetSpawnStatus: spawn.reset,
		selectItem,
		spawnStatus,
		spawnStatusMessage,
	};
};
