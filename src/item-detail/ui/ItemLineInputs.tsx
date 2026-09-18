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
}: Omit<readItemLineInputsFx.Props, "runtime"> & {
	readonly idle: boolean;
}) => {
	const game = useGameEngine();
	const translator = useTranslator();
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type) => {
			const result = game.readFn(
				readItemLineInputsFx({
					ownerItemId,
					line,
					runtime,
				}),
			);
			if (Exit.isFailure(result)) throw result.cause;
			return result.value;
		},
		[
			game,
			ownerItemId,
			line,
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
				const colorFraction = input.committed
					? 1
					: input.filled > 0
						? input.filled / total
						: input.available
							? 1
							: 0;
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
								<span className="block">
									{translator.textFn("Available")}:{" "}
									<strong className="font-bold">{input.availableQuantity}</strong>
								</span>
							</span>
						}
					>
						<span
							className="relative block"
							data-input-index={input.inputIndex}
						>
							<span
								className="block transition-opacity duration-300 ease-out data-[ui-available-only=true]:opacity-40 data-[ui-idle=true]:data-[ui-available-only=false]:opacity-60"
								{...readDataUiFn({
									dataUi: "ItemLineInput",
									state: {
										availableOnly: input.filled === 0 && input.available,
										idle,
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
							{total > 1 ? (
								<span className="absolute -right-1 -bottom-1 z-30 rounded-full bg-surface px-1.5 py-0.5 text-xs font-semibold text-foreground shadow-sm">
									{input.filled}/{total}
								</span>
							) : null}
						</span>
					</Tooltip>
				);
			})}
		</div>
	);
};
