import { queryOptions } from "@tanstack/react-query";
import { Cause, Exit, Option } from "effect";

import type { Game } from "~/bridge/game/Game";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { acquireGameEngineResourceFx } from "~/bridge/game/acquireGameEngineResourceFx";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

export namespace gameEngineQueryOptions {
	export interface Props {
		readonly acquisitionSignal?: AbortSignal;
		readonly packageId: string;
		readonly awaitPreviousShutdown?: Promise<void>;
		readonly beforeCreate?: (signal: AbortSignal) => Promise<void>;
		readonly create?: (packageId: string, signal: AbortSignal) => Promise<Game>;
		readonly rememberPackage?: (packageId: string) => Promise<void>;
	}
}

const runGameEngineQuery = async (
	props: acquireGameEngineResourceFx.Props,
): Promise<GameEngineResource> => {
	const exit = await RendererRuntime.runPromiseExit(acquireGameEngineResourceFx(props), {
		signal: props.signal,
	});
	if (Exit.isSuccess(exit)) return exit.value;
	const failure = Cause.failureOption(exit.cause);
	if (Option.isSome(failure)) throw failure.value;
	if (Cause.isInterruptedOnly(exit.cause) && props.signal.aborted) {
		throw (
			props.signal.reason ??
			new DOMException("Game Engine acquisition was aborted.", "AbortError")
		);
	}
	throw Cause.squash(exit.cause);
};

/** Creates the one renderer-wide live Game Engine resource after prior HMR ownership settles. */
export const gameEngineQueryOptions = ({
	acquisitionSignal,
	packageId,
	awaitPreviousShutdown = Promise.resolve(),
	beforeCreate,
	create,
	rememberPackage,
}: gameEngineQueryOptions.Props) =>
	queryOptions({
		queryKey: gameEngineQueryKey,
		meta: {
			packageId,
		},
		queryFn: ({ signal: querySignal }) => {
			const signal =
				acquisitionSignal === undefined
					? querySignal
					: AbortSignal.any([
							querySignal,
							acquisitionSignal,
						]);
			return runGameEngineQuery({
				awaitPreviousShutdown,
				packageId,
				signal,
				...(beforeCreate === undefined
					? {}
					: {
							beforeCreate,
						}),
				...(create === undefined
					? {}
					: {
							create,
						}),
				...(rememberPackage === undefined
					? {}
					: {
							rememberPackage,
						}),
			});
		},
		gcTime: Number.POSITIVE_INFINITY,
		retry: false,
		staleTime: Number.POSITIVE_INFINITY,
		structuralSharing: false,
	});
