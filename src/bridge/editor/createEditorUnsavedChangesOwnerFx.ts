import { Effect } from "effect";

import type {
	EditorUnsavedChangesService,
	EditorUnsavedChangesSession,
	EditorUnsavedChangesSnapshot,
} from "~/bridge/editor/EditorUnsavedChanges";

const idleSnapshot: EditorUnsavedChangesSnapshot = {
	canSave: false,
	error: undefined,
	hasDirtySession: false,
	promptOpen: false,
	saving: false,
};

/** Acquires one process owner for mounted editor drafts and their leave decision. */
export const createEditorUnsavedChangesOwnerFx = Effect.fn("createEditorUnsavedChangesOwnerFx")(
	() =>
		Effect.sync((): EditorUnsavedChangesService => {
			const sessions = new Map<string, EditorUnsavedChangesSession>();
			const listeners = new Set<() => void>();
			let snapshot = idleSnapshot;
			let activeRequest: Promise<boolean> | undefined;
			let prompt:
				| {
						readonly sessions: ReadonlyArray<EditorUnsavedChangesSession>;
						readonly resolve: (allow: boolean) => void;
				  }
				| undefined;

			const dirtySessions = (pathname?: string) =>
				[
					...sessions.values(),
				].filter(
					(session) =>
						session.isDirty() &&
						(pathname === undefined || !session.ownsPathname(pathname)),
				);
			const publish = (next: EditorUnsavedChangesSnapshot) => {
				if (
					snapshot.canSave === next.canSave &&
					Object.is(snapshot.error, next.error) &&
					snapshot.hasDirtySession === next.hasDirtySession &&
					snapshot.promptOpen === next.promptOpen &&
					snapshot.saving === next.saving
				)
					return;
				snapshot = next;
				for (const listener of listeners) listener();
			};
			const publishIdle = () =>
				publish({
					...idleSnapshot,
					hasDirtySession: dirtySessions().length > 0,
				});
			const refresh = () => {
				if (prompt === undefined) publishIdle();
			};
			const settle = (allow: boolean) => {
				const current = prompt;
				prompt = undefined;
				publishIdle();
				current?.resolve(allow);
			};

			return {
				decide: async (decision) => {
					const current = prompt;
					if (current === undefined || snapshot.saving) return;
					if (decision === "cancel") {
						settle(false);
						return;
					}
					if (decision === "discard") {
						for (const session of current.sessions) session.discard();
						settle(true);
						return;
					}
					if (!snapshot.canSave) return;
					publish({
						...snapshot,
						error: undefined,
						saving: true,
					});
					try {
						for (const session of current.sessions) {
							if (!(await session.save()))
								throw new Error("The editor draft could not be saved.");
						}
						settle(true);
					} catch (error) {
						publish({
							...snapshot,
							error,
							saving: false,
						});
					}
				},
				discardAll: () => {
					for (const session of dirtySessions()) session.discard();
					if (prompt === undefined) publishIdle();
					else settle(true);
				},
				getSnapshot: () => snapshot,
				refresh,
				register: (id, session) => {
					sessions.set(id, session);
					refresh();
					return () => {
						if (sessions.get(id) !== session) return;
						sessions.delete(id);
						refresh();
					};
				},
				requestLeave: (pathname) => {
					if (activeRequest !== undefined) return activeRequest;
					const leaving = dirtySessions(pathname);
					if (leaving.length === 0) return Promise.resolve(true);
					let resolveLeave: (allow: boolean) => void = () => undefined;
					const decision = new Promise<boolean>((resolve) => {
						resolveLeave = resolve;
					});
					activeRequest = decision.finally(() => {
						activeRequest = undefined;
					});
					void Promise.all(
						leaving.map((session) =>
							Promise.resolve(session.isValid()).catch(() => false),
						),
					).then((validity) => {
						prompt = {
							resolve: resolveLeave,
							sessions: leaving,
						};
						publish({
							canSave: validity.every(Boolean),
							error: undefined,
							hasDirtySession: true,
							promptOpen: true,
							saving: false,
						});
					});
					return activeRequest;
				},
				subscribe: (listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
			};
		}),
);
