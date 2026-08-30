import { useHotkey } from "@tanstack/react-hotkeys";
import {
	type KeyboardEvent,
	type PointerEvent,
	type RefObject,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { match, P } from "ts-pattern";

import { useGameCheats } from "~/game-cheat/ui/useGameCheats";
import type { PlayableGame } from "~/renderer/game/PlayableGame";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";
import { CheatItemSpawnContext } from "~/game-cheat/context/CheatItemSpawnContext";
import { useCheatItemSpotlightSearch } from "~/game-cheat/ui/useCheatItemSpotlightSearch";
import { useGameMenuControl } from "~/game-menu/ui/GameMenuProvider";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";

const errorMessage = (error: unknown) =>
	match(error)
		.with(P.instanceOf(Error), (current) => current.message)
		.otherwise(String);

interface CheatItemSpotlightControllerProps {
	readonly alwaysAvailable?: boolean;
	readonly game: PlayableGame;
	readonly onBeforeOpen?: () => void;
}

interface SelectItemProps {
	readonly index: number;
	readonly itemId: string;
}

interface CheatItemSpotlightControllerOutput {
	readonly inputRef: RefObject<HTMLInputElement | null>;
	readonly onBackdropPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
	readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
	readonly onQueryChange: (query: string) => void;
	readonly open: boolean;
	readonly query: string;
	readonly requestSelected: () => void;
	readonly results: ReturnType<typeof useCheatItemSpotlightSearch>["results"];
	readonly selectItem: (props: SelectItemProps) => void;
	readonly selectedIndex: number;
	readonly setSelectedIndex: (index: number) => void;
	readonly spawnStatus: "error" | "idle" | "pending" | "success";
	readonly spawnStatusMessage: string;
}

export const useCheatItemSpotlightController = ({
	alwaysAvailable = false,
	game,
	onBeforeOpen,
}: CheatItemSpotlightControllerProps): CheatItemSpotlightControllerOutput => {
	const cheats = useGameCheats(game);
	const cheatAvailability = useCheatAvailability();
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();
	const spawn = use(CheatItemSpawnContext);
	if (spawn === null) throw new Error("CheatItemSpawnProvider is not mounted.");
	const search = useCheatItemSpotlightSearch({
		game,
	});
	const inputRef = useRef<HTMLInputElement>(null);
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
		({ index, itemId }: SelectItemProps) => {
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
