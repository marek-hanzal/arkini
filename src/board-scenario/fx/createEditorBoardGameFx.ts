import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { EditorBoardGame } from "~/board-scenario/type/EditorBoardGame";
import { createGameResourceUrlsFx } from "~/playable-game/fx/createGameResourceUrlsFx";
import { createGameSessionFx } from "~/game-session/fx/createGameSessionFx";
import { discardGameBootstrapFx } from "~/playable-game/fx/discardGameBootstrapFx";
import { startFx } from "~/game-start/fx/startFx";
import { setCheatEnabledFx } from "~/game-cheat/fx/setCheatEnabledFx";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";

export namespace createEditorBoardGameFx {
	export interface Props {
		readonly project: Project;
		readonly state?: StateSchema.Type;
	}
}

/** Creates one fresh canonical game session without any durable save capability. */
export const createEditorBoardGameFx = Effect.fn("createEditorBoardGameFx")(function* ({
	project,
	state,
}: createEditorBoardGameFx.Props) {
	const session = yield* createGameSessionFx({
		config: project.config,
		...(state === undefined
			? {}
			: {
					state,
				}),
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
		if (state === undefined) yield* session.runFx(startFx());
		yield* session.runFx(
			setCheatEnabledFx({
				enabled: true,
			}),
		);

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
