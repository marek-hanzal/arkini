import { memo, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameItemView } from "~/v0/item/ui/GameItemView";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import { toGameActionError } from "~/v0/play/action/toGameActionError";
import { SheetHeader } from "~/v0/play/sheet/SheetHeader";
import { useGameAction, useGameItemCatalogView } from "~/v0/play/runtime";
import { cn } from "~/v0/ui/cn";

export namespace CheatInventorySheet {
	export interface Props {
		onClose(): void;
	}
}

type SpawnLocation = "board" | "inventory";

interface CheatItemButtonProps {
	disabled: boolean;
	item: ViewItem;
	onSpawn(location: SpawnLocation): void;
}

const singleClickDelayMs = 220;

const storageLabel = (storage: ViewItem["storage"]) => {
	switch (storage) {
		case "board":
			return "board only";
		case "inventory":
			return "inventory only";
		case "both":
			return "board + inventory";
		default: {
			const exhaustive: never = storage;
			return exhaustive;
		}
	}
};

const CheatItemButton = memo(({ disabled, item, onSpawn }: CheatItemButtonProps) => {
	const clickTimerRef = useRef<number | undefined>(undefined);

	const clearPendingSingleClick = useCallback(() => {
		if (clickTimerRef.current === undefined) return;
		window.clearTimeout(clickTimerRef.current);
		clickTimerRef.current = undefined;
	}, []);

	useEffect(
		() => clearPendingSingleClick,
		[
			clearPendingSingleClick,
		],
	);

	const handleClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			if (disabled) return;

			if (event.detail >= 2) {
				clearPendingSingleClick();
				onSpawn("inventory");
				return;
			}

			if (event.detail === 0) {
				onSpawn("board");
				return;
			}

			clearPendingSingleClick();
			clickTimerRef.current = window.setTimeout(() => {
				clickTimerRef.current = undefined;
				onSpawn("board");
			}, singleClickDelayMs);
		},
		[
			clearPendingSingleClick,
			disabled,
			onSpawn,
		],
	);

	return (
		<button
			type="button"
			data-ui="cheat inventory item"
			data-ak-item-id={item.id}
			className={cn(
				"group flex min-h-0 min-w-0 flex-col rounded-sm border border-ak-border bg-ak-surface-soft p-1.5 text-left transition-[transform,border-color,background,opacity] active:translate-y-px",
				"hover:border-ak-border-accent hover:bg-ak-primary-soft focus-visible:outline-ak-focus",
				disabled && "cursor-wait opacity-55",
			)}
			disabled={disabled}
			title={`${item.name}\nSingle click: board\nDouble click: inventory`}
			onClick={handleClick}
		>
			<span className="aspect-square w-full rounded-sm bg-ak-board/80 p-1">
				<GameItemView
					item={item}
					variant="inventory"
				/>
			</span>
			<span className="mt-1 min-w-0 w-full truncate text-center text-[0.68rem] font-black leading-tight text-ak-text">
				{item.name}
			</span>
			<span className="mt-0.5 min-w-0 w-full truncate text-center text-[0.56rem] font-bold uppercase tracking-[0.08em] text-ak-text-muted">
				{storageLabel(item.storage)}
			</span>
		</button>
	);
});

export const CheatInventorySheet = memo(({ onClose }: CheatInventorySheet.Props) => {
	const catalog = useGameItemCatalogView();
	const action = useGameAction();
	const [lastResult, setLastResult] = useState<string | undefined>();
	const [lastError, setLastError] = useState<string | undefined>();

	const items = useMemo(
		() =>
			Object.values(catalog)
				.filter((item): item is ViewItem => Boolean(item))
				.sort(
					(left, right) =>
						left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
				),
		[
			catalog,
		],
	);

	const spawnItem = useCallback(
		async (item: ViewItem, location: SpawnLocation) => {
			setLastError(undefined);
			setLastResult(undefined);

			try {
				await action.run({
					itemId: item.id,
					location,
					type: "debug.item.spawn",
				});
				setLastResult(
					location === "board"
						? `${item.name} dropped on board.`
						: `${item.name} added to inventory.`,
				);
			} catch (error) {
				setLastError(toGameActionError(error).message);
			}
		},
		[
			action.run,
		],
	);

	return (
		<div
			data-ui="cheat inventory root"
			className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 w-full flex-col overflow-hidden bg-ak-surface"
		>
			<SheetHeader
				title="Cheat Inventory"
				onClose={onClose}
			/>

			<div className="border-b border-ak-border bg-ak-surface-soft px-3 py-2 text-center text-xs font-bold leading-snug text-ak-text-muted">
				Single click spawns one item on board. Double click adds one item to game inventory.
			</div>

			{lastError ? (
				<div className="border-b border-rose-500/20 bg-ak-danger-soft px-3 py-2 text-center text-xs font-extrabold text-rose-200">
					{lastError}
				</div>
			) : lastResult ? (
				<div className="border-b border-emerald-400/20 bg-ak-success-soft px-3 py-2 text-center text-xs font-extrabold text-emerald-200">
					{lastResult}
				</div>
			) : null}

			<div
				data-ui="cheat inventory body"
				className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
			>
				<div className="mx-auto grid w-full max-w-[520px] grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-2">
					{items.map((item) => (
						<CheatItemButton
							key={item.id}
							disabled={action.isPending}
							item={item}
							onSpawn={(location) => spawnItem(item, location)}
						/>
					))}
				</div>
			</div>
		</div>
	);
});
