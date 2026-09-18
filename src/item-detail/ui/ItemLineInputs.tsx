import { Clock } from "lucide-react";
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

/** Compact material slots; delivery availability never counts as material already in the job. */
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
				const colorFraction = input.committed ? 1 : input.filled / total;
				const status = input.committed
					? translator.textFn("In use for this job.")
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
								{input.clock !== undefined ? (
									<span className="block">
										{input.clock.kind === "expiry"
											? translator.textFn("Time until the next one expires")
											: translator.textFn("Time until the next cycle")}
										:{" "}
										<strong>
											{(Math.max(0, input.clock.remainingMs) / 1000).toFixed(
												1,
											)}{" "}
											s
										</strong>
									</span>
								) : null}
								<span className="block">
									{translator.textFn("Available")}:{" "}
									<strong className="font-bold">{input.availableQuantity}</strong>
								</span>
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
								<span className="absolute -top-1 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-surface px-1.5 py-0.5 text-xs font-semibold tabular-nums text-foreground shadow-sm">
									<Clock className="size-3" />
									{(Math.max(0, input.clock.remainingMs) / 1000).toFixed(1)} s
								</span>
							) : null}
							{total > 1 ? (
								<span className="absolute -right-1 -bottom-1 z-30 rounded-full bg-surface px-1.5 py-0.5 text-xs font-semibold text-foreground shadow-sm">
									{input.filled}/{total}
								</span>
							) : null}
						</button>
					</Tooltip>
				);
			})}
		</div>
	);
};
