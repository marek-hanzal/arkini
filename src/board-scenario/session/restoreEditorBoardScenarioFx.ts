import { Effect, Result } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProject } from "~/project-authoring/EditorProject";
import { EditorProjectRepository } from "~/project-authoring/repository/EditorProjectRepository";
import { EditorBoardGameResourceOwnerAtom } from "~/board-scenario/session/EditorBoardGameResourceOwnerAtom";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { fromStateFx } from "~/game-persistence/fromStateFx";
import { decodeArkiniSaveFx } from "~/game-persistence/decodeArkiniSaveFx";
import type { StateSchema } from "~/game-persistence/StateSchema";
import { readArkpackVersionFn } from "~/engine/version/fn/readArkpackVersionFn";

export namespace restoreEditorBoardScenarioFx {
	export type Result =
		| {
				readonly type: "restored";
		  }
		| {
				readonly type: "rejected";
				readonly reason: string;
		  };
}

const replaceGameFx = (project: EditorProject, state?: StateSchema.Type) =>
	Atom.get(EditorBoardGameResourceOwnerAtom).pipe(
		Effect.flatMap((owner) =>
			owner === undefined
				? Effect.fail(new Error("Editor Board game owner is not configured."))
				: owner.replaceFx(project, state),
		),
	);

const errorMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/** Strictly validates one persisted scenario before replacing the live editor session. */
export const restoreEditorBoardScenarioFx = Effect.fn("restoreEditorBoardScenarioFx")(function* ({
	project,
	name,
}: {
	readonly project: EditorProject;
	readonly name: string;
}) {
	const repository = yield* EditorProjectRepository;
	const record = yield* repository.readBoardScenarioFx({
		projectId: project.projectId,
		name,
	});
	if (record === null) {
		return yield* Effect.fail(new Error(`Board scenario ${name} does not exist.`));
	}
	const validated = yield* Effect.result(
		Effect.gen(function* () {
			const saved = yield* decodeArkiniSaveFx(record.bytes);
			if (saved.version !== record.version) {
				return yield* Effect.fail(
					new Error("Scenario metadata does not match its save payload."),
				);
			}
			const projectVersion = readArkpackVersionFn(project.version);
			const saveVersion = readArkpackVersionFn(saved.version);
			if (saveVersion.major !== projectVersion.major) {
				return yield* Effect.fail(
					new Error(
						`Scenario version ${saved.version} is incompatible with project version ${project.version}.`,
					),
				);
			}
			yield* fromStateFx({
				state: saved.state,
			}).pipe(Effect.provideService(GameConfigFx, project.config));
			return saved.state;
		}),
	);
	if (Result.isSuccess(validated)) {
		yield* replaceGameFx(project, validated.success);
		return {
			type: "restored",
		} satisfies restoreEditorBoardScenarioFx.Result;
	}
	const reason = errorMessage(validated.failure);
	return {
		type: "rejected",
		reason,
	} satisfies restoreEditorBoardScenarioFx.Result;
});
