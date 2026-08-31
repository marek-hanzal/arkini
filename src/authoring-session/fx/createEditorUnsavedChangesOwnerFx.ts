import { Effect } from "effect";

import type {
	EditorUnsavedChangesService,
	EditorUnsavedChangesSession,
	EditorUnsavedChangesSnapshot,
} from "~/authoring-session/service/EditorUnsavedChanges";

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
						readonly resolveFn: (allow: boolean) => void;
				  }
				| undefined;

			const dirtySessionsFn = (pathname?: string) =>
				[
					...sessions.values(),
				].filter(
					(session) =>
						session.isDirtyFn() &&
						(pathname === undefined || !session.ownsPathnameFn(pathname)),
				);
			const publishFn = (next: EditorUnsavedChangesSnapshot) => {
				if (
					snapshot.canSave === next.canSave &&
					Object.is(snapshot.error, next.error) &&
					snapshot.hasDirtySession === next.hasDirtySession &&
					snapshot.promptOpen === next.promptOpen &&
					snapshot.saving === next.saving
				)
					return;
				snapshot = next;
				for (const listenerFn of listeners) listenerFn();
			};
			const publishIdleFn = () =>
				publishFn({
					...idleSnapshot,
					hasDirtySession: dirtySessionsFn().length > 0,
				});
			const refreshFn = () => {
				if (prompt === undefined) publishIdleFn();
			};
			const settleFn = (allow: boolean) => {
				const current = prompt;
				prompt = undefined;
				publishIdleFn();
				current?.resolveFn(allow);
			};

			return {
				decideFn: async (decision) => {
					const current = prompt;
					if (current === undefined || snapshot.saving) return;
					if (decision === "cancel") {
						settleFn(false);
						return;
					}
					if (decision === "discard") {
						for (const session of current.sessions) session.discardFn();
						settleFn(true);
						return;
					}
					if (!snapshot.canSave) return;
					publishFn({
						...snapshot,
						error: undefined,
						saving: true,
					});
					try {
						for (const session of current.sessions) {
							if (!(await session.saveFn()))
								throw new Error("The editor draft could not be saved.");
						}
						settleFn(true);
					} catch (error) {
						publishFn({
							...snapshot,
							error,
							saving: false,
						});
					}
				},
				discardAllFn: () => {
					for (const session of dirtySessionsFn()) session.discardFn();
					if (prompt === undefined) publishIdleFn();
					else settleFn(true);
				},
				getSnapshotFn: () => snapshot,
				refreshFn,
				registerFn: (id, session) => {
					sessions.set(id, session);
					refreshFn();
					return () => {
						if (sessions.get(id) !== session) return;
						sessions.delete(id);
						refreshFn();
					};
				},
				requestLeaveFn: (pathname) => {
					if (activeRequest !== undefined) return activeRequest;
					const leaving = dirtySessionsFn(pathname);
					if (leaving.length === 0) return Promise.resolve(true);
					let resolveLeaveFn: (allow: boolean) => void = () => undefined;
					const decision = new Promise<boolean>((resolveFn) => {
						resolveLeaveFn = resolveFn;
					});
					activeRequest = decision.finally(() => {
						activeRequest = undefined;
					});
					void Promise.all(
						leaving.map((session) =>
							Promise.resolve(session.isValidFn()).catch(() => false),
						),
					).then((validity) => {
						prompt = {
							resolveFn: resolveLeaveFn,
							sessions: leaving,
						};
						publishFn({
							canSave: validity.every(Boolean),
							error: undefined,
							hasDirtySession: true,
							promptOpen: true,
							saving: false,
						});
					});
					return activeRequest;
				},
				subscribeFn: (listenerFn) => {
					listeners.add(listenerFn);
					return () => listeners.delete(listenerFn);
				},
			};
		}),
);
