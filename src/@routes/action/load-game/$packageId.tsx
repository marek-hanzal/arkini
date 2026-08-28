import { createFileRoute, redirect, type ErrorComponentProps } from "@tanstack/react-router";

import { Cause, Effect, Exit, Option } from "effect";
import { runActionRouteFx } from "~/@routes/action/-runActionRouteFx";
import { releaseCurrentEditorBoardGameFx } from "~/bridge/editor/board/releaseCurrentEditorBoardGameFx";
import { acquireGameEngineLeaseFx } from "~/bridge/game/acquireGameEngineLeaseFx";
import { adoptGameEngineLeaseFx } from "~/bridge/game/adoptGameEngineLeaseFx";
import { readExactCauseFailureFx } from "~/bridge/game/readExactCauseFailureFx";
import { readCurrentGameEngineResourceFx } from "~/bridge/game/readCurrentGameEngineResourceFx";
import { GameEngineErrorView } from "~/ui/game/GameEngineErrorView";
import { ActionLoadingScreen } from "~/ui/loading/ActionLoadingScreen";

const loadGameRouteFx = Effect.fn("loadGameRouteFx")((packageId: string) =>
	Effect.scoped(
		Effect.gen(function* () {
			yield* releaseCurrentEditorBoardGameFx;
			const lease = yield* runActionRouteFx(
				acquireGameEngineLeaseFx({
					packageId,
				}),
			);
			return yield* adoptGameEngineLeaseFx(lease);
		}),
	),
);

/**
 * This action route is the only route-level Game acquisition owner. A newly
 * acquired lease survives the scoped loader only when adoption publishes it;
 * interruption otherwise releases it. Package switches first traverse the
 * current Game's leave route, while editor handoff joins its ephemeral disposal
 * here, preventing two live resources from overlapping.
 */
export const Route = createFileRoute("/action/load-game/$packageId")({
	beforeLoad: ({ context, params }) => {
		const resource = context.rendererRuntime.runSync(readCurrentGameEngineResourceFx());
		if (resource === null) return;
		resource.assertUsable();
		if (resource.game.arkpack.packageId === params.packageId) return;
		throw redirect({
			to: "/game/$packageId/action/leave",
			params: {
				packageId: resource.game.arkpack.packageId,
			},
			search: {
				destination: "game",
				packageId: params.packageId,
			},
			replace: true,
		});
	},
	loader: async ({ abortController, context, params }) => {
		const completed = await context.rendererRuntime.runPromiseExit(
			loadGameRouteFx(params.packageId),
			{
				signal: abortController.signal,
			},
		);
		if (Exit.isFailure(completed)) {
			const failure = context.rendererRuntime.runSync(
				readExactCauseFailureFx(completed.cause),
			);
			if (Option.isSome(failure)) throw failure.value;
			if (Cause.hasInterruptsOnly(completed.cause) && abortController.signal.aborted) {
				throw (
					abortController.signal.reason ??
					new DOMException("Game Engine loading was aborted.", "AbortError")
				);
			}
			throw completed.cause;
		}
		const resource = completed.value;
		if (resource.game.arkpack.packageId !== params.packageId) {
			throw redirect({
				to: "/game/$packageId/action/leave",
				params: {
					packageId: resource.game.arkpack.packageId,
				},
				search: {
					destination: "game",
					packageId: params.packageId,
				},
				replace: true,
			});
		}
		resource.assertUsable();
		throw redirect({
			to: "/game/$packageId/board",
			params,
			replace: true,
		});
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionLoadingScreen label="Loading game…" />,
	errorComponent: (props: ErrorComponentProps) => {
		const { packageId } = Route.useParams();
		return (
			<GameEngineErrorView
				{...props}
				packageId={packageId}
			/>
		);
	},
});
