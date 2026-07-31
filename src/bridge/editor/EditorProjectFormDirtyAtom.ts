import * as Atom from "effect/unstable/reactivity/Atom";

export interface EditorProjectFormDirtyCommand {
	readonly dirty: boolean;
	readonly ownerId: string;
}

/** Projects active local-form dirtiness into editor exit and controlled-close policy. */
export const EditorProjectFormDirtyAtom = Atom.family((projectId: string) => {
	const ownersAtom = Atom.make<ReadonlySet<string>>(new Set<string>());
	return Atom.writable(
		(get) => get(ownersAtom).size > 0,
		(context, command: EditorProjectFormDirtyCommand) => {
			const current = context.get(ownersAtom);
			if (current.has(command.ownerId) === command.dirty) return;
			const next = new Set(current);
			if (command.dirty) next.add(command.ownerId);
			else next.delete(command.ownerId);
			context.set(ownersAtom, next);
		},
	).pipe(Atom.withLabel(`EditorProjectFormDirty:${projectId}`));
});
