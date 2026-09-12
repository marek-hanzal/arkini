import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { EditorBoardGame } from "~/editor-board/type/EditorBoardGame";
import { readProjectResourceUrlFn } from "~/project-authoring/fn/readProjectResourceUrlFn";
import { createGameSessionFx } from "~/game-session/fx/createGameSessionFx";
import { discardGameBootstrapFx } from "~/playable-game/fx/discardGameBootstrapFx";
import { startFx } from "~/game-start/fx/startFx";
import { setCheatEnabledFx } from "~/game-cheat/fx/setCheatEnabledFx";
import { installGameDiagnosticsFx } from "~/game-incident/fx/installGameDiagnosticsFx";

export namespace createEditorBoardGameFx {
	export interface Props {
		readonly project: Project;
	}
}

/** Creates one fresh canonical game session without any durable save capability. */
export const createEditorBoardGameFx = Effect.fn("createEditorBoardGameFx")(function* ({
	project,
}: createEditorBoardGameFx.Props) {
	const session = yield* createGameSessionFx({
		config: project.config,
	});
	const resourcesById = new Map(
		project.resources.map((resource) => [
			resource.id,
			resource,
		]),
	);
	const releaseResourcesFx = Effect.sync(() => resourcesById.clear());
	const discardFailedBootstrapFx = discardGameBootstrapFx(session, releaseResourcesFx);

	return yield* Effect.gen(function* () {
		yield* session.runFx(startFx());
		yield* session.runFx(
			setCheatEnabledFx({
				enabled: true,
			}),
		);

		const diagnostics = yield* installGameDiagnosticsFx({
			projectId: project.projectId,
			projectRevision: project.revision,
			config: project.config,
			restored: false,
			runRendererEffectFn: Effect.runSync,
			session,
		});
		const disposeFx = session.disposeWithoutSaveFx.pipe(
			Effect.tap(() => Effect.sync(() => diagnostics.close("discarded"))),
			Effect.andThen(releaseResourcesFx),
		);
		const game: EditorBoardGame = {
			...session,
			config: project.config,
			diagnosticSessionId: diagnostics.sessionId,
			disposeFx,
			disposeWithoutSaveFx: disposeFx,
			projectId: project.projectId,
			projectRevision: project.revision,
			getResourceUrlFn: (resourceId) => {
				const resource = resourcesById.get(resourceId);
				if (resource === undefined)
					throw new Error(`Editor game resource ${resourceId} is unavailable.`);
				return readProjectResourceUrlFn({
					projectId: project.projectId,
					resourceId,
					version: resource.version,
				});
			},
		};
		return game;
	}).pipe(Effect.onError(() => discardFailedBootstrapFx));
});
