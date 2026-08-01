import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";

export namespace EditorProjectDraftAtom {
	export type State = Readonly<Record<string, EditorItem>>;
	export type Command =
		| {
				readonly action: "clear";
		  }
		| {
				readonly action: "stage";
				readonly item: EditorItem;
		  }
		| {
				readonly action: "remove";
				readonly item: EditorItem;
		  };
}

/** Owns validated item changes until the editor's explicit project Save persists them. */
export const EditorProjectDraftAtom = Atom.family((projectId: string) => {
	const stateAtom = Atom.make<EditorProjectDraftAtom.State>({});
	return Atom.writable(
		(get) => get(stateAtom),
		(context, command: EditorProjectDraftAtom.Command) => {
			const current = context.get(stateAtom);
			if (command.action === "clear") {
				context.set(stateAtom, {});
				return;
			}
			if (command.action === "stage") {
				context.set(stateAtom, {
					...current,
					[command.item.uid]: command.item,
				});
				return;
			}
			if (current[command.item.uid] !== command.item) return;
			const next = {
				...current,
			};
			delete next[command.item.uid];
			context.set(stateAtom, next);
		},
	).pipe(Atom.withLabel(`EditorProjectDraft:${projectId}`), Atom.setIdleTTL(0));
});
