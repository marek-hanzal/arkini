import { Context } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

export type EditorUnsavedChangesDecision = "cancel" | "discard" | "save";

export interface EditorUnsavedChangesSession {
	readonly discard: () => void;
	readonly isDirty: () => boolean;
	readonly isValid: () => boolean | Promise<boolean>;
	readonly ownsPathname: (pathname: string) => boolean;
	readonly save: () => Promise<boolean>;
}

export interface EditorUnsavedChangesSnapshot {
	readonly canSave: boolean;
	readonly error: unknown;
	readonly hasDirtySession: boolean;
	readonly promptOpen: boolean;
	readonly saving: boolean;
}

export interface EditorUnsavedChangesService {
	readonly decide: (decision: EditorUnsavedChangesDecision) => Promise<void>;
	readonly getSnapshot: () => EditorUnsavedChangesSnapshot;
	readonly refresh: () => void;
	readonly register: (id: string, session: EditorUnsavedChangesSession) => () => void;
	readonly requestLeave: (pathname?: string) => Promise<boolean>;
	readonly subscribe: (listener: () => void) => () => void;
}

export class EditorUnsavedChanges extends Context.Service<
	EditorUnsavedChanges,
	EditorUnsavedChangesService
>()("EditorUnsavedChanges") {}

export const EditorUnsavedChangesOwnerAtom = Atom.make<EditorUnsavedChangesService | undefined>(
	undefined,
).pipe(Atom.keepAlive);
