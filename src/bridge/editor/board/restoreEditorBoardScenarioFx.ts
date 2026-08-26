import { Effect, Result } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { EditorBoardGameResourceOwnerAtom } from "~/bridge/editor/board/EditorBoardGameResource";
import { readArkpackVersionFx } from "~/bridge/game/ArkpackVersionCompatibility";
import { decodeArkiniSaveFx } from "~/bridge/save/decodeArkiniSaveFx";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { fromStateFx } from "~/engine/runtime/fx/fromStateFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";

export type RestoreEditorBoardScenarioResult =
	| {
			readonly type: "restored";
	  }
	| {
			readonly type: "discarded";
			readonly reason: string;
	  };

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
			const projectVersion = yield* readArkpackVersionFx(project.version);
			const saveVersion = yield* readArkpackVersionFx(saved.version);
			if (saveVersion.major !== projectVersion.major) {
				return yield* Effect.fail(
					new Error(
						`Scenario version ${saved.version} is incompatible with project version ${project.version}.`,
					),
				);
			}
			if (saveVersion.minor > projectVersion.minor) {
				return yield* Effect.fail(
					new Error(
						`Scenario version ${saved.version} is newer than project version ${project.version}.`,
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
		} satisfies RestoreEditorBoardScenarioResult;
	}
	const reason = errorMessage(validated.failure);
	yield* repository.deleteBoardScenarioFx({
		projectId: project.projectId,
		name,
	});
	yield* replaceGameFx(project);
	return {
		type: "discarded",
		reason,
	} satisfies RestoreEditorBoardScenarioResult;
});
