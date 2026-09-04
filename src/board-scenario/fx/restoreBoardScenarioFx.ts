import { Effect, Result, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { Project } from "~/project-authoring/type/Project";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { EditorBoardGameResourceOwnerAtom } from "~/board-scenario/atom/EditorBoardGameResourceOwnerAtom";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { decodeArkiniSaveFx } from "~/game-persistence/fx/decodeArkiniSaveFx";
import { readMajorFn as readGameVersionMajorFn } from "~/game-version/fn/readMajorFn";

export namespace restoreBoardScenarioFx {
	export type Result =
		| {
				readonly type: "restored";
		  }
		| {
				readonly type: "rejected";
				readonly reason: string;
		  };
}

const errorMessageFn = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/** Strictly validates one persisted scenario before replacing the live editor session. */
export const restoreBoardScenarioFx = Effect.fn("restoreEditorBoardScenarioFx")(function* ({
	project,
	name,
}: {
	readonly project: Project;
	readonly name: string;
}) {
	const owner = yield* Atom.get(EditorBoardGameResourceOwnerAtom);
	if (owner === undefined)
		return yield* Effect.fail(new Error("Editor Board game owner is not configured."));
	// A routed successor may share the project revision but must not inherit this restore.
	const expected = yield* SubscriptionRef.get(owner.state);
	const repository = yield* ProjectRepository;
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
			const projectVersion = readGameVersionMajorFn(project.version);
			const saveVersion = readGameVersionMajorFn(saved.version);
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
		yield* owner.replaceFx(project, expected, validated.success);
		return {
			type: "restored",
		} satisfies restoreBoardScenarioFx.Result;
	}
	const reason = errorMessageFn(validated.failure);
	return {
		type: "rejected",
		reason,
	} satisfies restoreBoardScenarioFx.Result;
});
