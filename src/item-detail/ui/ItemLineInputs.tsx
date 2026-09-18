import { Equal, Exit } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { readItemLineInputsFx } from "~/item-detail-read/fx/readItemLineInputsFx";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { ItemArtwork } from "~/ui/ui/ItemArtwork";
import { Tooltip } from "~/ui/ui/Tooltip";

/** Compact material slots; delivery availability never counts as material already in the job. */
export const ItemLineInputs = ({
	ownerItemId,
	line,
}: Omit<readItemLineInputsFx.Props, "runtime">) => {
	const game = useGameEngine();
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
				return (
					<Tooltip
						key={input.inputIndex}
						content={item.title}
					>
						<span
							className="relative block"
							data-input-index={input.inputIndex}
						>
							<span
								className="block data-[ui-available-only=true]:opacity-40"
								{...readDataUiFn({
									dataUi: "ItemLineInput",
									state: {
										availableOnly: input.filled === 0 && input.available,
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
