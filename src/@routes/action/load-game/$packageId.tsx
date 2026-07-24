import { createFileRoute, redirect, type ErrorComponentProps } from "@tanstack/react-router";

import { Cause, Effect, Exit, Option } from "effect";
import { acquireGameEngineLeaseFx } from "~/bridge/game/acquireGameEngineLeaseFx";
import { getCachedGameEngineResourceFx } from "~/bridge/game/getCachedGameEngineResourceFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRouteFx } from "~/page/action/runActionRouteFx";
import { GameEngineErrorPage } from "~/page/game/GameEngineErrorPage";
import { waitForActiveViewTransitionFx } from "~/ui/navigation/waitForActiveViewTransitionFx";

const redirectToOwnedGame = (ownedPackageId: string, requestedPackageId: string): never => {
	throw redirect({
		to: "/game/$packageId/action/leave",
		params: {
			packageId: ownedPackageId,
		},
		search: {
			destination: "game",
			packageId: requestedPackageId,
		},
		replace: true,
	});
};

export const Route = createFileRoute("/action/load-game/$packageId")({
	beforeLoad: ({ context, params }) => {
		const resource = RendererRuntime.runSync(
			getCachedGameEngineResourceFx(context.queryClient),
		);
		if (resource === null) return;
		resource.assertUsable();
		if (resource.game.arkpack.packageId === params.packageId) return;
		return redirectToOwnedGame(resource.game.arkpack.packageId, params.packageId);
	},
	loader: async ({ abortController, context, params }) => {
		const acquisition = RendererRuntime.runPromiseExit(
			acquireGameEngineLeaseFx({
				queryClient: context.queryClient,
				signal: abortController.signal,
				packageId: params.packageId,
				awaitPreviousShutdown: context.previousGameShutdown,
				beforeCreate: async () => {
					await RendererRuntime.runPromise(waitForActiveViewTransitionFx());
					abortController.signal.throwIfAborted();
				},
			}),
		);
		const completed = await RendererRuntime.runPromiseExit(
			runActionRouteFx(
				Effect.promise(() => acquisition).pipe(
					Effect.flatMap((exit) =>
						Exit.isFailure(exit)
							? Effect.failCause(exit.cause)
							: Effect.succeed(exit.value),
					),
				),
			),
		);
		if (Exit.isFailure(completed)) {
			const failure = Cause.failureOption(completed.cause);
			if (Option.isSome(failure)) throw failure.value;
			throw Cause.squash(completed.cause);
		}
		const lease = completed.value;
		if (lease.resource.game.arkpack.packageId !== params.packageId) {
			return redirectToOwnedGame(lease.resource.game.arkpack.packageId, params.packageId);
		}
		const resource = RendererRuntime.runSync(lease.adoptFx);
		resource.assertUsable();
		throw redirect({
			to: "/game/$packageId/board",
			params,
			replace: true,
		});
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionPendingPage label="Loading game…" />,
	errorComponent: GameLoadErrorPage,
});

function GameLoadErrorPage(props: ErrorComponentProps) {
	const { packageId } = Route.useParams();
	return (
		<GameEngineErrorPage
			{...props}
			packageId={packageId}
		/>
	);
}
