import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProject, EditorProjectCommit } from "~/project-authoring/type/EditorProject";

export namespace EditorProjectAtom {
	export interface State {
		readonly project: EditorProject | undefined;
		readonly pendingCommits: ReadonlyMap<number, EditorProjectCommit>;
	}

	export type Command =
		| {
				readonly project: EditorProject;
				readonly commit?: never;
				readonly replacement?: never;
		  }
		| {
				readonly commit: EditorProjectCommit;
				readonly project?: never;
				readonly replacement?: never;
		  }
		| {
				readonly replacement: EditorProject;
				readonly commit?: never;
				readonly project?: never;
		  };
}

/** Projects the newest committed repository result into mounted editor surfaces. */
export const EditorProjectAtom = Atom.family((projectId: string) => {
	const stateAtom = Atom.make<EditorProjectAtom.State>({
		project: undefined,
		pendingCommits: new Map(),
	});
	const applyPendingCommits = (
		initial: EditorProject,
		pendingCommits: Map<number, EditorProjectCommit>,
	) => {
		let project = initial;
		for (const [previousRevision, commit] of pendingCommits) {
			if (commit.revision <= project.revision) pendingCommits.delete(previousRevision);
		}
		while (true) {
			const commit = pendingCommits.get(project.revision);
			if (commit === undefined) return project;
			pendingCommits.delete(commit.previousRevision);
			project = {
				...project,
				...commit,
				resources: project.resources,
			};
		}
	};
	return Atom.writable(
		(get) => get(stateAtom).project,
		(context, command: EditorProjectAtom.Command) => {
			const state = context.get(stateAtom);
			if (command.replacement !== undefined) {
				if (command.replacement.projectId !== projectId) return;
				context.set(stateAtom, {
					project: command.replacement,
					pendingCommits: new Map(),
				});
				return;
			}
			const pendingCommits = new Map(state.pendingCommits);
			if (command.project !== undefined) {
				if (command.project.projectId !== projectId) return;
				if (
					state.project !== undefined &&
					state.project.revision > command.project.revision
				)
					return;
				context.set(stateAtom, {
					project: applyPendingCommits(command.project, pendingCommits),
					pendingCommits,
				});
				return;
			}
			if (command.commit.projectId !== projectId) return;
			if (state.project !== undefined && command.commit.revision <= state.project.revision)
				return;
			pendingCommits.set(command.commit.previousRevision, command.commit);
			context.set(stateAtom, {
				project:
					state.project === undefined
						? undefined
						: applyPendingCommits(state.project, pendingCommits),
				pendingCommits,
			});
		},
	).pipe(Atom.withLabel(`EditorProject:${projectId}`), Atom.setIdleTTL(0));
});
