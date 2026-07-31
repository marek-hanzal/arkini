import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProject } from "~/bridge/editor/EditorProject";

export namespace EditorProjectAtom {
	export type Command =
		| {
				readonly action: "refresh";
				readonly expectedRevision: string | undefined;
				readonly project: EditorProject;
		  }
		| {
				readonly action: "publish";
				readonly expectedRevision: string;
				readonly project: EditorProject;
		  };
}

/** CAS-owned compiled project snapshot shared by every editor surface. */
export const EditorProjectAtom = Atom.family((projectId: string) => {
	const stateAtom = Atom.make<EditorProject | undefined>(undefined);
	return Atom.writable(
		(get) => get(stateAtom),
		(context, command: EditorProjectAtom.Command) => {
			if (command.project.projectId !== projectId) return;
			const current = context.get(stateAtom);
			if (
				current !== undefined &&
				current.revision !== command.expectedRevision &&
				current.revision !== command.project.revision
			) {
				return;
			}
			context.set(stateAtom, command.project);
		},
	).pipe(Atom.withLabel(`EditorProject:${projectId}`));
});
