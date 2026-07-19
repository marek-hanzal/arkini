import { queryOptions } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { createGameFx } from "~/bridge/game/createGameFx";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

export namespace gameEngineQueryOptions {
	export interface Props {
		readonly packageId: string;
		readonly awaitPreviousShutdown?: Promise<void>;
		readonly beforeCreate?: () => Promise<void>;
		readonly create?: (packageId: string) => Promise<Game>;
	}
}

/** Creates the one renderer-wide live Game Engine resource after prior HMR ownership settles. */
export const gameEngineQueryOptions = ({
	packageId,
	awaitPreviousShutdown = Promise.resolve(),
	beforeCreate = () => Promise.resolve(),
	create = (selectedPackageId) =>
		RendererRuntime.runPromise(
			createGameFx({
				packageId: selectedPackageId,
			}),
		),
}: gameEngineQueryOptions.Props) =>
	queryOptions({
		queryKey: gameEngineQueryKey,
		queryFn: async () => {
			await awaitPreviousShutdown;
			await beforeCreate();
			const game = await create(packageId);
			if (game.arkpack.packageId !== packageId) {
				await RendererRuntime.runPromise(game.disposeWithoutSaveFx);
				throw new Error(
					`Game Engine creation returned package ${game.arkpack.packageId} for requested package ${packageId}.`,
				);
			}
			return RendererRuntime.runPromise(createGameEngineResourceFx(game));
		},
		gcTime: Number.POSITIVE_INFINITY,
		retry: false,
		staleTime: Number.POSITIVE_INFINITY,
		structuralSharing: false,
	});
