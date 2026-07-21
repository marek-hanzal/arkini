import { useHotkey } from "@tanstack/react-hotkeys";
import Fuse from "fuse.js";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Game } from "~/bridge/game/Game";
import { useCheatItemCatalog } from "~/bridge/cheat/useCheatItemCatalog";
import { useGameCheats } from "~/bridge/cheat/useGameCheats";
import { useSpawnCheatItemMutation } from "~/bridge/cheat/useSpawnCheatItemMutation";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

const maxVisibleResults = 10;
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Owns the Board-local Cheat item search, keyboard navigation and canonical spawn command. */
export const CheatItemSpotlight = ({ game }: { readonly game: Game }) => {
	const cheats = useGameCheats(game);
	const cheatAvailability = useCheatAvailability();
	const catalog = useCheatItemCatalog(game);
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();
	const spawn = useSpawnCheatItemMutation(game);
	const inputRef = useRef<HTMLInputElement>(null);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const fuse = useMemo(
		() =>
			new Fuse(catalog, {
				keys: [
					"itemId",
					"title",
					"categoryId",
					"tags",
				],
				threshold: 0.28,
				ignoreLocation: true,
			}),
		[
			catalog,
		],
	);
	const results = useMemo(
		() =>
			(query.trim() === ""
				? catalog
				: fuse.search(query.trim()).map((match) => match.item)
			).slice(0, maxVisibleResults),
		[
			catalog,
			fuse,
			query,
		],
	);
	const blockedByHigherOwner = gameMenu.isOpen || itemDetail.isOpen;
	const available = cheatAvailability.available && cheats.enabled && !blockedByHigherOwner;

	useHotkey(
		"Mod+P",
		() => {
			if (!available && !open) return;
			setOpen((current) => !current);
			spawn.reset();
		},
		{
			enabled: cheatAvailability.available && cheats.enabled,
			preventDefault: true,
		},
	);

	useEffect(() => {
		if (!cheatAvailability.available || !cheats.enabled || blockedByHigherOwner) setOpen(false);
	}, [
		blockedByHigherOwner,
		cheatAvailability.available,
		cheats.enabled,
	]);

	useEffect(() => {
		if (!open) return;
		setQuery("");
		setSelectedIndex(0);
		queueMicrotask(() => inputRef.current?.focus());
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
	const requestSpawn = () => {
		if (selected === undefined || spawn.isPending) return;
		spawn.mutate(selected.itemId);
	};

	return (
		<div
			className="absolute inset-0 z-[75] grid cursor-default place-items-start overflow-hidden bg-overlay/75 p-[var(--ak-viewport-padding)] pt-[12vh] text-overlay-foreground"
			data-ui="CheatItemSpotlightBackdrop"
			onPointerDown={(event) => {
				if (event.currentTarget === event.target) setOpen(false);
			}}
		>
			<section
				className="mx-auto grid w-[38rem] max-w-full gap-3 rounded-2xl border border-line-strong bg-surface-raised p-4 text-foreground shadow-2xl"
				aria-labelledby="cheat-item-spotlight-title"
				data-ui="CheatItemSpotlight"
			>
				<h2
					id="cheat-item-spotlight-title"
					className="sr-only"
				>
					Spawn item
				</h2>
				<input
					ref={inputRef}
					type="search"
					value={query}
					className="w-full rounded-lg border border-line-strong bg-surface px-4 py-3 text-base text-foreground outline-none focus:border-accent"
					placeholder="Search item title or ID…"
					aria-label="Search items to spawn"
					onChange={(event) => {
						setQuery(event.currentTarget.value);
						setSelectedIndex(0);
						spawn.reset();
					}}
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							event.preventDefault();
							event.stopPropagation();
							setOpen(false);
							return;
						}
						if (event.key === "ArrowDown") {
							event.preventDefault();
							setSelectedIndex((current) =>
								results.length === 0 ? 0 : (current + 1) % results.length,
							);
							return;
						}
						if (event.key === "ArrowUp") {
							event.preventDefault();
							setSelectedIndex((current) =>
								results.length === 0
									? 0
									: (current - 1 + results.length) % results.length,
							);
							return;
						}
						if (event.key === "Enter") {
							event.preventDefault();
							requestSpawn();
						}
					}}
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
								disabled={spawn.isPending}
								onMouseEnter={() => setSelectedIndex(index)}
								onClick={() => {
									setSelectedIndex(index);
									spawn.mutate(item.itemId);
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
								<span className="ak-spotlight-option-secondary text-xs">
									{item.categoryId}
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
					{spawn.isPending ? (
						<p className="text-accent">Spawning…</p>
					) : spawn.isError ? (
						<p className="text-danger">Spawn failed: {errorMessage(spawn.error)}</p>
					) : spawn.isSuccess ? (
						<p className="text-muted">Item spawned.</p>
					) : (
						<p className="text-muted">↑↓ select · Enter spawn · Esc close</p>
					)}
				</div>
			</section>
		</div>
	);
};
