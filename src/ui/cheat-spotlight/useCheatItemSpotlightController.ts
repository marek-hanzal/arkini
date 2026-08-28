import { useHotkey } from "@tanstack/react-hotkeys";
import {
	type KeyboardEvent,
	type PointerEvent,
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { match, P } from "ts-pattern";

import { useGameCheats } from "~/bridge/cheat/useGameCheats";
import type { PlayableGame } from "~/bridge/game/PlayableGame";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";
import { useCheatItemSpawn } from "~/ui/cheat-spotlight/useCheatItemSpawn";
import { useCheatItemSpotlightSearch } from "~/ui/cheat-spotlight/useCheatItemSpotlightSearch";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

const errorMessage = (error: unknown) =>
	match(error)
		.with(P.instanceOf(Error), (current) => current.message)
		.otherwise(String);

export namespace useCheatItemSpotlightController {
	export interface Props {
		readonly alwaysAvailable?: boolean;
		readonly game: PlayableGame;
		readonly onBeforeOpen?: () => void;
	}

	export interface SelectItemProps {
		readonly index: number;
		readonly itemId: string;
	}

	export interface Output {
		readonly inputRef: RefObject<HTMLInputElement | null>;
		readonly onBackdropPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
		readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
		readonly onQueryChange: (query: string) => void;
		readonly open: boolean;
		readonly query: string;
		readonly requestSelected: () => void;
		readonly results: ReadonlyArray<useCheatItemSpotlightSearch.Item>;
		readonly selectItem: (props: SelectItemProps) => void;
		readonly selectedIndex: number;
		readonly setSelectedIndex: (index: number) => void;
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
	const spawn = useCheatItemSpawn();
	const search = useCheatItemSpotlightSearch({
		game,
	});
	const inputRef = useRef<HTMLInputElement>(null);
	const preserveSpawnOutcomeRef = useRef(false);
	const [open, setOpen] = useState(false);
	const blockedByHigherOwner = gameMenu.isOpen || itemDetail.isOpen;
	const admitted = alwaysAvailable || cheatAvailability.available;
	const available = admitted && cheats.enabled && !blockedByHigherOwner;
	const close = useCallback(() => {
		if (spawn.pending) preserveSpawnOutcomeRef.current = true;
		setOpen(false);
	}, [
		spawn.pending,
	]);
	const toggle = useCallback(() => {
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
		search.reset();
		setOpen(true);
	}, [
		available,
		close,
		onBeforeOpen,
		open,
		search.reset,
		spawn.pending,
		spawn.reset,
	]);
	const onQueryChange = useCallback(
		(value: string) => {
			search.changeQuery(value);
			spawn.reset();
		},
		[
			search.changeQuery,
			spawn.reset,
		],
	);
	const requestSelected = useCallback(() => {
		if (search.selectedItemId !== undefined) spawn.request(search.selectedItemId);
	}, [
		search.selectedItemId,
		spawn.request,
	]);
	const selectItem = useCallback(
		({ index, itemId }: useCheatItemSpotlightController.SelectItemProps) => {
			search.setSelectedIndex(index);
			spawn.request(itemId);
		},
		[
			search.setSelectedIndex,
			spawn.request,
		],
	);
	const onBackdropPointerDown = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (event.currentTarget === event.target) close();
		},
		[
			close,
		],
	);
	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLElement>) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			event.stopPropagation();
			close();
		},
		[
			close,
		],
	);

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

	useEffect(() => {
		if (!open) return;
		queueMicrotask(() => inputRef.current?.focus());
	}, [
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

	return useMemo(
		() => ({
			inputRef,
			onBackdropPointerDown,
			onKeyDown,
			onQueryChange,
			open,
			query: search.query,
			requestSelected,
			results: search.results,
			selectItem,
			selectedIndex: search.selectedIndex,
			setSelectedIndex: search.setSelectedIndex,
			spawnStatus,
			spawnStatusMessage,
		}),
		[
			onBackdropPointerDown,
			onKeyDown,
			onQueryChange,
			open,
			requestSelected,
			search.query,
			search.results,
			search.selectedIndex,
			search.setSelectedIndex,
			selectItem,
			spawnStatus,
			spawnStatusMessage,
		],
	);
};
