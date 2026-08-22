import { Effect } from "effect";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorBoardGame } from "~/bridge/editor/board/EditorBoardGame";
import { createGameResourceUrlsFx } from "~/bridge/game/createGameResourceUrlsFx";
import { createGameSessionFx } from "~/bridge/game/createGameSessionFx";
import { discardGameBootstrapFx } from "~/bridge/game/discardGameBootstrapFx";
import { startFx } from "~/engine/start/write/startFx";

export namespace createEditorBoardGameFx {
	export interface Props {
		readonly project: EditorProject;
	}
}

/** Creates one fresh canonical game session without any durable save capability. */
export const createEditorBoardGameFx = Effect.fn("createEditorBoardGameFx")(function* ({
	project,
}: createEditorBoardGameFx.Props) {
	const session = yield* createGameSessionFx({
		config: project.config,
	});
	let resourceUrls: Effect.Success<ReturnType<typeof createGameResourceUrlsFx>> | undefined;
	const discardFailedBootstrapFx = discardGameBootstrapFx(
		session,
		Effect.suspend(() => resourceUrls?.releaseFx ?? Effect.void),
	);

	return yield* Effect.gen(function* () {
		resourceUrls = yield* createGameResourceUrlsFx({
			owner: "Editor game",
			resources: project.resources,
		});
		yield* session.runFx(startFx());

		const liveResourceUrls = resourceUrls;
		const disposeFx = session.disposeWithoutSaveFx.pipe(
			Effect.andThen(liveResourceUrls.releaseFx),
		);
		const game: EditorBoardGame = {
			...session,
			config: project.config,
			disposeFx,
			disposeWithoutSaveFx: disposeFx,
			projectId: project.projectId,
			projectRevision: project.revision,
			getResourceUrl: liveResourceUrls.get,
		};
		return game;
	}).pipe(Effect.onError(() => discardFailedBootstrapFx));
});
