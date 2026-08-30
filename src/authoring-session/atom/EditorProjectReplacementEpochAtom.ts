import * as Atom from "effect/unstable/reactivity/Atom";

/** Signals one explicit whole-project replacement without remounting on ordinary commits. */
export const EditorProjectReplacementEpochAtom = Atom.family((_projectId: string) =>
	Atom.make(0).pipe(Atom.setIdleTTL(0)),
);
