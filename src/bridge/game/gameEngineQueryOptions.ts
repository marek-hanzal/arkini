import { queryOptions } from "@tanstack/react-query";
import { Cause, Exit, Option } from "effect";

import { toCriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { createGameFx } from "~/bridge/game/createGameFx";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { writeLastPackageIdFx } from "~/bridge/launcher/writeLastPackageIdFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

export namespace gameEngineQueryOptions {
	export interface Props {
		readonly packageId: string;
		readonly awaitPreviousShutdown?: Promise<void>;
		readonly beforeCreate?: () => Promise<void>;
		readonly create?: (packageId: string) => Promise<Game>;
		readonly rememberPackage?: (packageId: string) => Promise<void>;
	}
}

/** Creates the one renderer-wide live Game Engine resource after prior HMR ownership settles. */
export const gameEngineQueryOptions = ({
	packageId,
	awaitPreviousShutdown = Promise.resolve(),
	beforeCreate = () => Promise.resolve(),
	create = async (selectedPackageId) => {
		const exit = await RendererRuntime.runPromiseExit(
			createGameFx({
				packageId: selectedPackageId,
			}),
		);
		if (Exit.isSuccess(exit)) return exit.value;
		const failure = Cause.failureOption(exit.cause);
		if (Option.isSome(failure)) throw failure.value;
		throw Cause.squash(exit.cause);
	},
	rememberPackage = (selectedPackageId) =>
		RendererRuntime.runPromise(writeLastPackageIdFx(selectedPackageId)),
}: gameEngineQueryOptions.Props) =>
	queryOptions({
		queryKey: gameEngineQueryKey,
		meta: {
			packageId,
		},
		queryFn: async () => {
			try {
				await awaitPreviousShutdown;
			} catch (cause) {
				throw toCriticalGameLifecycleError({
					operation: "hmr-handoff",
					cause,
				});
			}
			await beforeCreate();
			const game = await create(packageId);
			if (game.arkpack.packageId !== packageId) {
				await RendererRuntime.runPromise(game.disposeWithoutSaveFx);
				throw toCriticalGameLifecycleError({
					operation: "engine-ownership",
					cause: new Error(
						`Game Engine creation returned package ${game.arkpack.packageId} for requested package ${packageId}.`,
					),
				});
			}
			await rememberPackage(packageId).catch(() => undefined);
			return RendererRuntime.runPromise(createGameEngineResourceFx(game));
		},
		gcTime: Number.POSITIVE_INFINITY,
		retry: false,
		staleTime: Number.POSITIVE_INFINITY,
		structuralSharing: false,
	});
