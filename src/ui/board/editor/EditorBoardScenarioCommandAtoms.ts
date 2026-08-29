import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { restoreEditorBoardScenarioFx } from "~/renderer/editor/board/restoreEditorBoardScenarioFx";
import { saveEditorBoardScenarioFx } from "~/renderer/editor/board/saveEditorBoardScenarioFx";
import { RendererRuntime } from "~/renderer/RendererRuntime";

export const EditorBoardScenarioCommandAtoms = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) => ({
		list: Atom.family((projectId: string) =>
			Atom.fn(() => repository.listBoardScenariosFx(projectId)).pipe(Atom.setIdleTTL(0)),
		),
		save: Atom.fn((props: saveEditorBoardScenarioFx.Props) =>
			saveEditorBoardScenarioFx(props).pipe(
				Effect.provideService(EditorProjectRepository, repository),
			),
		).pipe(Atom.setIdleTTL(0)),
		restore: Atom.fn((props: Parameters<typeof restoreEditorBoardScenarioFx>[0]) =>
			restoreEditorBoardScenarioFx(props).pipe(
				Effect.provideService(EditorProjectRepository, repository),
			),
		).pipe(Atom.setIdleTTL(0)),
		remove: Atom.family((projectId: string) =>
			Atom.fn((name: string) =>
				repository.deleteBoardScenarioFx({
					projectId,
					name,
				}),
			).pipe(Atom.setIdleTTL(0)),
		),
	})),
);
