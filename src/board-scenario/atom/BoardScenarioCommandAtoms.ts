import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { restoreBoardScenarioFx } from "~/board-scenario/fx/restoreBoardScenarioFx";
import { saveBoardScenarioFx } from "~/board-scenario/fx/saveBoardScenarioFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

/** Board Scenario persistence commands bound to the mounted renderer repository. */
export const BoardScenarioCommandAtoms = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) => ({
		list: Atom.family((projectId: string) =>
			Atom.fn(() => repository.listBoardScenariosFx(projectId)).pipe(Atom.setIdleTTL(0)),
		),
		save: Atom.fn((props: saveBoardScenarioFx.Props) =>
			saveBoardScenarioFx(props).pipe(Effect.provideService(ProjectRepository, repository)),
		).pipe(Atom.setIdleTTL(0)),
		restore: Atom.fn((props: Parameters<typeof restoreBoardScenarioFx>[0]) =>
			restoreBoardScenarioFx(props).pipe(
				Effect.provideService(ProjectRepository, repository),
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
