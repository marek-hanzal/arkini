import {
	autoUpdate,
	flip,
	FloatingPortal,
	offset,
	shift,
	useClick,
	useDismiss,
	useFloating,
	useInteractions,
} from "@floating-ui/react";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { Game } from "~/installed-game/type/Game";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";
import type { GameSaveSlotSchema } from "~/game-persistence/schema/GameSaveSlotSchema";
import { Button } from "~/ui/ui/Button";

const slots = [
	{
		slot: "manual",
		label: "Manual",
	},
	{
		slot: "current",
		label: "Current autosave",
	},
	{
		slot: "5-min",
		label: "5-minute checkpoint",
	},
	{
		slot: "30-min",
		label: "30-minute checkpoint",
	},
	{
		slot: "4-hour",
		label: "4-hour checkpoint",
	},
] as const;

/** The installed game's save picker reads fresh slot timestamps each time it opens. */
export const GameSaveMenu = ({
	game,
	disabled,
	onLoadFn,
}: {
	readonly game: Game;
	readonly disabled: boolean;
	readonly onLoadFn: (slot: GameSaveSlotSchema.Type) => void;
}) => {
	const [open, setOpenFn] = useState(false);
	const [saves, setSavesFn] = useState<readonly GameSaveStorage.Slot[]>();
	const [error, setErrorFn] = useState<string>();
	const { context, floatingStyles, refs } = useFloating({
		open,
		onOpenChange: setOpenFn,
		placement: "right-start",
		middleware: [
			offset(8),
			flip(),
			shift({
				padding: 12,
			}),
		],
		whileElementsMounted: autoUpdate,
	});
	const { getReferenceProps: getReferencePropsFn, getFloatingProps: getFloatingPropsFn } =
		useInteractions([
			useClick(context, {
				enabled: !disabled,
			}),
			useDismiss(context),
		]);
	useEffect(() => {
		if (!open) return;
		let active = true;
		setSavesFn(undefined);
		setErrorFn(undefined);
		void RendererRuntime.runPromise(game.listSavesFx).then(
			(value) => {
				if (active) setSavesFn(value);
			},
			(cause) => {
				if (active) setErrorFn(cause instanceof Error ? cause.message : String(cause));
			},
		);
		return () => {
			active = false;
		};
	}, [
		game,
		open,
	]);
	useEffect(() => {
		if (disabled) setOpenFn(false);
	}, [
		disabled,
	]);
	return (
		<>
			<Button
				ref={refs.setReference}
				className="w-full gap-2 shadow-none"
				disabled={disabled}
				{...getReferencePropsFn()}
			>
				Load <ChevronDown className="size-4" />
			</Button>
			{open ? (
				<FloatingPortal>
					<div
						ref={refs.setFloating}
						style={floatingStyles}
						className="z-[100] w-80 max-h-[80vh] overflow-y-auto rounded-xl border border-line-strong bg-modal p-2 text-foreground shadow-2xl"
						data-ui="GameSaveMenu"
						{...getFloatingPropsFn()}
					>
						{slots.map(({ slot, label }) => {
							const savedAt = saves?.find((save) => save.slot === slot)?.savedAt;
							return (
								<Button
									key={slot}
									className="h-auto w-full flex-col items-start gap-1 px-3 py-2 text-left shadow-none"
									disabled={disabled || savedAt == null}
									onClick={() => {
										setOpenFn(false);
										onLoadFn(slot);
									}}
								>
									<span>
										{label}
										{slot === "manual" ? " · F9" : ""}
									</span>
									<span className="text-xs text-muted">
										{savedAt != null
											? new Date(savedAt).toLocaleString()
											: error !== undefined
												? "Could not check availability"
												: saves === undefined
													? "Checking…"
													: "Not available"}
									</span>
								</Button>
							);
						})}
						<p className="px-3 pt-2 text-xs text-muted">
							Checkpoints refresh at these intervals. Times show when each was saved.
							Loading replaces your current progress.
						</p>
						{error !== undefined ? (
							<p className="px-3 pt-2 text-xs text-danger">{error}</p>
						) : null}
					</div>
				</FloatingPortal>
			) : null}
		</>
	);
};
