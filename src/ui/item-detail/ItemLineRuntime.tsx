import type { ItemDetailLines } from "~/ui/item-detail/ItemDetailLines";
import { formatItemDurationFn } from "~/ui/item-detail/fn/formatItemDurationFn";
import { ItemRuntime } from "~/ui/item-detail/ItemRuntime";
import { readActiveJobRuntimeFn } from "~/ui/item-detail/fn/readActiveJobRuntimeFn";

/** Renders the effective or active runtime presentation for one visible product line. */
export const ItemLineRuntime = ({ line }: { readonly line: ItemDetailLines.Line }) => {
	const activeJob = line.activeJob;
	const runtime =
		activeJob === undefined
			? {
					value: formatItemDurationFn(line.effectiveRuntimeMs),
					detail:
						line.baseRuntimeMs === line.effectiveRuntimeMs
							? "Per cycle"
							: `Base ${formatItemDurationFn(line.baseRuntimeMs)}`,
				}
			: readActiveJobRuntimeFn(activeJob);
	return (
		<ItemRuntime
			dataUi="TileLineRuntime"
			jobStatus={activeJob?.status ?? "idle"}
			runtime={runtime}
		/>
	);
};
