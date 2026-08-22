import { useHotkey } from "@tanstack/react-hotkeys";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { match } from "ts-pattern";

import type { PlayableGame } from "~/bridge/game/PlayableGame";
import { useCheatItemCatalog } from "~/bridge/cheat/useCheatItemCatalog";
import { useGameCheats } from "~/bridge/cheat/useGameCheats";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";
import { useCheatItemSpawn } from "~/ui/cheat-spotlight/useCheatItemSpawn";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { SpotlightSearchInput } from "~/ui/search/SpotlightSearchInput";
import { useFuseSearch } from "~/ui/search/useFuseSearch";

const maxVisibleResults = 10;
const focusableSelector = [
	"button:not([disabled])",
	"[href]",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",");

/** Owns the Board-local Cheat item search, keyboard navigation and canonical spawn command. */
export const CheatItemSpotlight = ({
	game,
	onBeforeOpen,
}: {
	readonly game: PlayableGame;
	readonly onBeforeOpen?: () => void;
}) => {
	const errorMessage = (error: unknown) =>
		error instanceof Error ? error.message : String(error);
	const cheats = useGameCheats(game);
	const cheatAvailability = useCheatAvailability();
	const catalog = useCheatItemCatalog(game);
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();
	const spawn = useCheatItemSpawn();
	const spawnError = spawn.state.kind === "error" ? spawn.state.error : undefined;
	const dialogRef = useRef<HTMLElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const originRef = useRef<HTMLElement | null>(null);
	const preserveSpawnOutcomeRef = useRef(false);
	const restoreFocusRef = useRef(true);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const searchCandidates = useMemo(
		() =>
			catalog.map((item) => ({
				identity: item.itemId,
				terms: [
					item.itemId,
					item.title,
				],
			})),
		[
			catalog,
		],
	);
	const matchingItemIds = useFuseSearch(searchCandidates, query);
	const catalogById = useMemo(
		() =>
			new Map(
				catalog.map((item) => [
					item.itemId,
					item,
				]),
			),
		[
			catalog,
		],
	);
	const results = matchingItemIds
		.flatMap((itemId) => {
			const item = catalogById.get(itemId);
			return item === undefined
				? []
				: [
						item,
					];
		})
		.slice(0, maxVisibleResults);
	const blockedByHigherOwner = gameMenu.isOpen || itemDetail.isOpen;
	const available = cheatAvailability.available && cheats.enabled && !blockedByHigherOwner;
	const closeSpotlight = useCallback(
		(restoreFocus = true) => {
			if (spawn.pending) preserveSpawnOutcomeRef.current = true;
			restoreFocusRef.current = restoreFocus;
			setOpen(false);
		},
		[
			spawn.pending,
		],
	);

	useHotkey(
		"Mod+P",
		() => {
			if (open) {
				closeSpotlight();
				return;
			}
			if (!available) return;
			originRef.current =
				document.activeElement instanceof HTMLElement ? document.activeElement : null;
			restoreFocusRef.current = true;
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
					() => {
						spawn.reset();
					},
				)
				.with(
					{
						preserveSpawnOutcome: false,
						spawnPending: true,
					},
					() => {},
				)
				.exhaustive();
			setOpen(true);
		},
		{
			enabled: cheatAvailability.available && cheats.enabled,
			preventDefault: true,
		},
	);

	useEffect(() => {
		if (!open) return;
		if (blockedByHigherOwner) {
			closeSpotlight(false);
			return;
		}
		if (!cheatAvailability.available || !cheats.enabled) closeSpotlight();
	}, [
		blockedByHigherOwner,
		cheatAvailability.available,
		closeSpotlight,
		cheats.enabled,
		open,
	]);

	useEffect(() => {
		if (!open) return;
		const canRestoreFocus = (element: HTMLElement) =>
			element.isConnected &&
			!element.hidden &&
			element.closest("[hidden], [inert]") === null &&
			element.style.display !== "none" &&
			element.style.visibility !== "hidden" &&
			element.style.pointerEvents !== "none";
		setQuery("");
		setSelectedIndex(0);
		queueMicrotask(() => (inputRef.current ?? dialogRef.current)?.focus());
		return () => {
			if (!restoreFocusRef.current) return;
			const origin = originRef.current;
			originRef.current = null;
			if (origin !== null && canRestoreFocus(origin)) {
				origin.focus();
				if (document.activeElement === origin) return;
			}
			document.querySelector<HTMLElement>('[data-ui="GameShell"]')?.focus();
		};
	}, [
		open,
	]);

	useEffect(() => {
		setSelectedIndex((current) => Math.min(current, Math.max(0, results.length - 1)));
	}, [
		results.length,
	]);

	if (!open) return null;

	const selected = results[selectedIndex];
	const requestSpawn = (itemId = selected?.itemId) => {
		if (itemId !== undefined) spawn.request(itemId);
	};
	const keepFocusInside = (event: ReactKeyboardEvent<HTMLElement>) => {
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			closeSpotlight();
			return;
		}
		if (event.key !== "Tab") return;
		const controls = Array.from(
			dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
		);
		if (controls.length === 0) {
			event.preventDefault();
			dialogRef.current?.focus();
			return;
		}
		const first = controls[0];
		const last = controls.at(-1);
		if (first === undefined || last === undefined) return;
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
			return;
		}
		if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	};

	return (
		<div
			className="absolute inset-0 z-[75] grid cursor-default place-items-start overflow-hidden bg-overlay/75 p-[var(--ak-viewport-padding)] pt-[12vh] text-overlay-foreground"
			data-ui="CheatItemSpotlightBackdrop"
			onPointerDown={(event) => {
				if (event.currentTarget === event.target) closeSpotlight();
			}}
		>
			<section
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				className="mx-auto grid w-[38rem] max-w-full gap-3 rounded-2xl border border-line-strong bg-surface-raised p-4 text-foreground shadow-2xl"
				aria-labelledby="cheat-item-spotlight-title"
				data-ui="CheatItemSpotlight"
				tabIndex={-1}
				onKeyDown={keepFocusInside}
			>
				<h2
					id="cheat-item-spotlight-title"
					className="sr-only"
				>
					Spawn item
				</h2>
				<SpotlightSearchInput
					ariaLabel="Search items to spawn"
					inputRef={inputRef}
					onEnter={() => requestSpawn()}
					onQueryChange={(value) => {
						setQuery(value);
						setSelectedIndex(0);
						spawn.reset();
					}}
					onSelectedIndexChange={setSelectedIndex}
					query={query}
					resultCount={results.length}
					selectedIndex={selectedIndex}
				/>

				<div
					className="grid max-h-[26rem] gap-1 overflow-y-auto"
					data-ui="CheatItemSpotlightResults"
				>
					{results.length === 0 ? (
						<p className="px-3 py-6 text-center text-sm text-muted">
							No spawnable items.
						</p>
					) : (
						results.map((item, index) => (
							<button
								type="button"
								key={item.itemId}
								className="ak-spotlight-option grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-lg border px-3 py-2 text-left"
								data-selected={index === selectedIndex ? "true" : undefined}
								onMouseEnter={() => setSelectedIndex(index)}
								onClick={() => {
									setSelectedIndex(index);
									requestSpawn(item.itemId);
								}}
							>
								<img
									src={item.sourceUrl}
									alt=""
									className="size-11 object-contain"
								/>
								<span className="min-w-0">
									<span className="block truncate text-sm font-semibold">
										{item.title}
									</span>
									<span className="ak-spotlight-option-secondary block truncate text-xs">
										{item.itemId}
									</span>
								</span>
							</button>
						))
					)}
				</div>

				<div
					className="min-h-5 text-center text-sm"
					aria-live="polite"
					data-ui="CheatItemSpotlightStatus"
				>
					{spawn.pending ? (
						<p className="text-accent">Spawning…</p>
					) : spawnError !== undefined ? (
						<p className="text-danger">Spawn failed: {errorMessage(spawnError)}</p>
					) : spawn.state.kind === "success" ? (
						<p className="text-muted">Item spawned.</p>
					) : (
						<p className="text-muted">↑↓ select · Enter spawn · Esc close</p>
					)}
				</div>
			</section>
		</div>
	);
};
