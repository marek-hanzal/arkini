import { X } from "lucide-react";
import { useItemLineInputController } from "~/item-detail/ui/useItemLineInputController";
import { Equal, Exit } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { readItemLineInputsFx } from "~/item-detail-read/fx/readItemLineInputsFx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { ItemArtwork } from "~/ui/ui/ItemArtwork";
import { Tooltip } from "~/ui/ui/Tooltip";

/** Shared input thumbnails; unit payers stay in place while material slots support delivery and withdrawal. */
export const ItemLineInputs = ({
	ownerItemId,
	line,
	idle,
	work,
	disabled,
}: Omit<readItemLineInputsFx.Props, "runtime"> & {
	readonly idle: boolean;
	readonly disabled: boolean;
}) => {
	const game = useGameEngine();
	const translator = useTranslator();
	const controller = useItemLineInputController({
		ownerItemId,
		lineId: line.id,
		disabled,
	});
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type) => {
			const result = game.readFn(
				readItemLineInputsFx({
					ownerItemId,
					line,
					runtime,
					work,
				}),
			);
			if (Exit.isFailure(result)) throw result.cause;
			return result.value;
		},
		[
			game,
			ownerItemId,
			line,
			work?.kind,
			work?.id,
		],
	);
	const inputs = useRuntimeSelector(game, selectorFn, Equal.equals);
	if (inputs.length === 0) return null;
	return (
		<div
			className="mt-3 flex flex-wrap items-center gap-3"
			data-ui="ItemLineInputs"
		>
			{inputs.map((input) => {
				const item = game.config.items[input.itemId];
				const total = input.quantity.max;
				const unavailable =
					input.filled === 0 && input.availableQuantity === 0 && !input.committed;
				const colorFraction = input.committed ? 1 : input.filled / total;
				const status = input.committed
					? input.type === "units"
						? translator.textFn("Units already spent for this job.")
						: translator.textFn("In use for this job.")
					: input.filled > 0
						? input.filled >= input.quantity.min
							? translator.textFn("Ready for this job.")
							: input.available
								? translator.textFn("Partly ready. More is available.")
								: translator.textFn("Partly ready. You'll need to find more.")
						: input.available
							? translator.textFn("Available for this job.")
							: translator.textFn("None available right now.");
				return (
					<Tooltip
						key={input.inputIndex}
						content={
							<span className="block max-w-64">
								<strong className="block font-bold">{item.title}</strong>
								<span className="block">{status}</span>
								{input.canWithdraw && !disabled ? (
									<span className="block">
										{translator.textFn("Click to take one back.")}
									</span>
								) : null}
								{input.canAutofill && !disabled ? (
									<span className="block">
										{translator.textFn("Click to bring this here.")}
									</span>
								) : null}
								{input.type === "materials" ? (
									<span className="block">
										{translator.textFn("Available")}:{" "}
										<strong className="font-bold">
											{input.availableQuantity}
										</strong>
									</span>
								) : null}
							</span>
						}
					>
						<button
							type="button"
							disabled={
								disabled ||
								controller.pending ||
								(!input.canWithdraw && !input.canAutofill)
							}
							onClick={() =>
								controller.activateFn(
									input.inputIndex,
									input.canWithdraw ? "withdraw" : "autofill",
								)
							}
							className="relative block cursor-pointer disabled:cursor-default"
							data-input-index={input.inputIndex}
						>
							<span
								className="block transition-opacity duration-300 ease-out data-[ui-dimmed=true]:opacity-45"
								{...readDataUiFn({
									dataUi: "ItemLineInput",
									state: {
										dimmed: idle || input.filled === 0,
									},
								})}
							>
								<ItemArtwork
									size="lg"
									sourceUrl={game.getResourceUrlFn(item.artwork.default[0])}
									compositeUrl={
										item.artwork.default[1] === undefined
											? undefined
											: game.getResourceUrlFn(item.artwork.default[1])
									}
									colorFraction={colorFraction}
								/>
							</span>
							{input.clock !== undefined ? (
								<ItemLineInputClock clock={input.clock} />
							) : null}
							{total > 1 ? (
								<span className="pointer-events-none absolute -right-1 -bottom-1 z-30 rounded-full bg-surface px-1.5 py-0.5 text-xs font-semibold text-foreground shadow-sm">
									{input.filled}/{total}
								</span>
							) : null}
							<span
								className="pointer-events-none absolute -top-1 -right-1 z-30 grid size-5 scale-75 place-items-center text-danger opacity-0 transition-[opacity,scale] duration-300 ease-out data-[ui-unavailable=true]:scale-100 data-[ui-unavailable=true]:opacity-100"
								{...readDataUiFn({
									dataUi: "ItemLineInputUnavailable",
									state: {
										unavailable,
									},
								})}
							>
								<X
									className="size-5"
									strokeWidth={3}
								/>
							</span>
						</button>
					</Tooltip>
				);
			})}
		</div>
	);
};

/** Mirrors the Board clock's track and hands without exposing an exact countdown. */
const ItemLineInputClock = ({
	clock,
}: {
	readonly clock: NonNullable<readItemLineInputsFx.Input["clock"]>;
}) => {
	const progress = Math.max(0, Math.min(1, 1 - clock.remainingMs / clock.durationMs));
	return (
		<svg
			data-ui="ItemLineInputClock"
			className="pointer-events-none absolute -top-1 -left-1 z-30 size-6 rounded-full bg-overlay/70 text-overlay-foreground"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.6}
		>
			<circle
				cx={12}
				cy={12}
				r={9}
				opacity={0.2}
			/>
			<circle
				cx={12}
				cy={12}
				r={9}
				pathLength={100}
				strokeDasharray={100}
				strokeDashoffset={(1 - progress) * 100}
				transform="rotate(-90 12 12)"
				className="transition-[stroke-dashoffset] duration-100 ease-linear"
			/>
			<path
				d="M12 7.5 V12 l3.15 1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
};
