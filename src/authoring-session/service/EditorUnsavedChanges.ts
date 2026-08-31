import { Context } from "effect";

type EditorUnsavedChangesDecision = "cancel" | "discard" | "save";

export interface EditorUnsavedChangesSession {
	readonly discardFn: () => void;
	readonly isDirtyFn: () => boolean;
	readonly isValidFn: () => boolean | Promise<boolean>;
	readonly ownsPathnameFn: (pathname: string) => boolean;
	readonly saveFn: () => Promise<boolean>;
}

export interface EditorUnsavedChangesSnapshot {
	readonly canSave: boolean;
	readonly error: unknown;
	readonly hasDirtySession: boolean;
	readonly promptOpen: boolean;
	readonly saving: boolean;
}

export interface EditorUnsavedChangesService {
	readonly decideFn: (decision: EditorUnsavedChangesDecision) => Promise<void>;
	readonly discardAllFn: () => void;
	readonly getSnapshotFn: () => EditorUnsavedChangesSnapshot;
	readonly refreshFn: () => void;
	readonly registerFn: (id: string, session: EditorUnsavedChangesSession) => () => void;
	readonly requestLeaveFn: (pathname?: string) => Promise<boolean>;
	readonly subscribeFn: (listenerFn: () => void) => () => void;
}

export class EditorUnsavedChanges extends Context.Service<
	EditorUnsavedChanges,
	EditorUnsavedChangesService
>()("EditorUnsavedChanges") {}
