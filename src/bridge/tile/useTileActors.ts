import { Exit } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { readRuntimeItemPrimaryAssetId } from "~/engine/item/read/readRuntimeItemPrimaryAssetId";
import { resolveJobRunnableFx } from "~/engine/job/fx/resolveJobRunnableFx";

export namespace useTileActors {
	export interface Item {
		readonly id: string;
		readonly revision: string;
		readonly itemId: string;
		readonly title: string;
		readonly quantity: number;
		readonly sourceUrl: string;
		readonly compositeUrl?: string;
		readonly location: GridLocationSchema.Type;
		readonly running: boolean;
	}
}

/** Projects every live grid item for the one Canvas-wide stable actor layer. */
export const useTileActors = (): ReadonlyArray<useTileActors.Item> => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): ReadonlyArray<useTileActors.Item> => {
			const activeJobs = new Map(
				runtime.jobs.map((job) => [
					job.ownerItemId,
					job,
				]),
			);
			return runtime.items.filter(isGridRuntimeItem).map((item) => {
				const activeJob = activeJobs.get(item.id);
				const runnableExit =
					activeJob === undefined || activeJob.remainingMs === 0
						? undefined
						: game.read(
								resolveJobRunnableFx({
									job: activeJob,
									runtime,
								}),
							);
				return {
					id: item.id,
					revision: item.revision,
					itemId: item.item.id,
					title: item.item.title,
					quantity: item.quantity,
					location: item.location,
					running:
						runnableExit !== undefined &&
						Exit.isSuccess(runnableExit) &&
						runnableExit.value,
					sourceUrl: game.getResourceUrl(
						readRuntimeItemPrimaryAssetId(runtime, item.item),
					),
					...(item.item.asset.composite === undefined
						? {}
						: {
								compositeUrl: game.getResourceUrl(item.item.asset.composite),
							}),
				};
			});
		},
		[
			game,
		],
	);

	return useRuntimeSelector(selector);
};
