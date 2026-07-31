import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorItem } from "~/bridge/editor/EditorItemModel";

export interface StagedEditorItem {
	readonly item: EditorItem;
	readonly sourceItemId?: string;
	readonly sourcePath?: string;
}

export namespace EditorProjectDraftAtom {
	export type State = Readonly<Record<string, StagedEditorItem>>;
	export type Command =
		| {
				readonly action: "stage";
				readonly change: StagedEditorItem;
				readonly key: string;
		  }
		| {
				readonly action: "remove";
				readonly change: StagedEditorItem;
				readonly key: string;
		  };
}

/** Holds validated project changes until the user explicitly persists them. */
export const EditorProjectDraftAtom = Atom.family((projectId: string) => {
	const stateAtom = Atom.make<EditorProjectDraftAtom.State>({});
	return Atom.writable(
		(get) => get(stateAtom),
		(context, command: EditorProjectDraftAtom.Command) => {
			const current = context.get(stateAtom);
			if (command.action === "stage") {
				context.set(stateAtom, {
					...current,
					[command.key]: command.change,
				});
				return;
			}
			if (current[command.key] !== command.change) return;
			const next = {
				...current,
			};
			delete next[command.key];
			context.set(stateAtom, next);
		},
	).pipe(Atom.withLabel(`EditorProjectDraft:${projectId}`));
});
