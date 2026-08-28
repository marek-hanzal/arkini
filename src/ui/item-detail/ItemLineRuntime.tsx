import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { formatItemDurationFx } from "~/ui/item-detail/formatItemDurationFx";
import { ItemRuntime } from "~/ui/item-detail/ItemRuntime";
import { readActiveJobRuntimeFx } from "~/ui/item-detail/readActiveJobRuntimeFx";

/** Renders the effective or active runtime presentation for one visible product line. */
export const ItemLineRuntime = ({ line }: { readonly line: ItemDetailLines.Line }) => {
	const activeJob = line.activeJob;
	const runtime =
		activeJob === undefined
			? {
					value: RendererRuntime.runSync(formatItemDurationFx(line.effectiveRuntimeMs)),
					detail:
						line.baseRuntimeMs === line.effectiveRuntimeMs
							? "Per cycle"
							: `Base ${RendererRuntime.runSync(formatItemDurationFx(line.baseRuntimeMs))}`,
				}
			: RendererRuntime.runSync(readActiveJobRuntimeFx(activeJob));
	return (
		<ItemRuntime
			dataUi="TileLineRuntime"
			jobStatus={activeJob?.status ?? "idle"}
			runtime={runtime}
		/>
	);
};
