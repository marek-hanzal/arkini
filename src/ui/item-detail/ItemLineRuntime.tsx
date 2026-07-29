import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import {
	formatItemDuration,
	ItemRuntime,
	readActiveJobRuntime,
} from "~/ui/item-detail/ItemRuntime";

/** Renders the effective or active runtime presentation for one visible product line. */
export const ItemLineRuntime = ({ line }: { readonly line: ItemDetailLines.Line }) => {
	const activeJob = line.activeJob;
	const runtime =
		activeJob === undefined
			? {
					value: formatItemDuration(line.effectiveRuntimeMs),
					detail:
						line.baseRuntimeMs === line.effectiveRuntimeMs
							? "Per cycle"
							: `Base ${formatItemDuration(line.baseRuntimeMs)}`,
				}
			: readActiveJobRuntime(activeJob);
	return (
		<ItemRuntime
			dataUi="TileLineRuntime"
			jobStatus={activeJob?.status ?? "idle"}
			runtime={runtime}
		/>
	);
};
