import { queryOptions } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import { createGameFx } from "~/bridge/game/createGameFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

export const gameEngineQueryRootKey = [
	"game-engine",
] as const;

export const gameEngineQueryKey = (packageId: string) =>
	[
		...gameEngineQueryRootKey,
		packageId,
	] as const;

export namespace gameEngineQueryOptions {
	export interface Props {
		readonly packageId: string;
		readonly awaitPreviousShutdown?: Promise<void>;
		readonly create?: (packageId: string) => Promise<Game>;
	}
}

/** Owns one stable live Game instance for the exact package until explicit route release. */
export const gameEngineQueryOptions = ({
	packageId,
	awaitPreviousShutdown = Promise.resolve(),
	create = (selectedPackageId) =>
		RendererRuntime.runPromise(
			createGameFx({
				packageId: selectedPackageId,
			}),
		),
}: gameEngineQueryOptions.Props) =>
	queryOptions({
		queryKey: gameEngineQueryKey(packageId),
		queryFn: async () => {
			await awaitPreviousShutdown;
			return create(packageId);
		},
		gcTime: Number.POSITIVE_INFINITY,
		retry: false,
		staleTime: Number.POSITIVE_INFINITY,
		structuralSharing: false,
	});
