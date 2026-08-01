import * as Atom from "effect/unstable/reactivity/Atom";

export interface EditorFormDirtyCommand {
	readonly dirty: boolean;
	readonly ownerId: string;
}

const ownersAtom = Atom.make<ReadonlySet<string>>(new Set<string>());

/** Projects mounted local-form dirtiness into editor exit and native-close policy. */
export const EditorFormDirtyAtom = Atom.writable(
	(get) => get(ownersAtom).size > 0,
	(context, command: EditorFormDirtyCommand) => {
		const current = context.get(ownersAtom);
		if (current.has(command.ownerId) === command.dirty) return;
		const next = new Set(current);
		if (command.dirty) next.add(command.ownerId);
		else next.delete(command.ownerId);
		context.set(ownersAtom, next);
	},
).pipe(Atom.withLabel("EditorFormDirty"));
