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
			let activeRequest:
				| {
						readonly decision: Promise<boolean>;
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
				if (!snapshot.promptOpen) publishIdleFn();
			};
			const settleFn = (request: typeof activeRequest, allow: boolean) => {
				if (request !== activeRequest) return;
				activeRequest = undefined;
				publishIdleFn();
				request?.resolveFn(allow);
			};

			return {
				decideFn: async (decision) => {
					const current = activeRequest;
					if (current === undefined || !snapshot.promptOpen || snapshot.saving) return;
					if (decision === "cancel") {
						settleFn(current, false);
						return;
					}
					if (decision === "discard") {
						for (const session of current.sessions) session.discardFn();
						settleFn(current, true);
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
							if (activeRequest !== current) return;
							if (!(await session.saveFn()))
								throw new Error("The editor draft could not be saved.");
						}
						settleFn(current, true);
					} catch (error) {
						if (activeRequest !== current) return;
						publishFn({
							...snapshot,
							error,
							saving: false,
						});
					}
				},
				discardAllFn: () => {
					const current = activeRequest;
					for (const session of dirtySessionsFn()) session.discardFn();
					settleFn(current, false);
				},
				getSnapshotFn: () => snapshot,
				refreshFn,
				registerFn: (id, session) => {
					const previous = sessions.get(id);
					sessions.set(id, session);
					if (
						previous !== undefined &&
						previous !== session &&
						activeRequest?.sessions.includes(previous)
					)
						settleFn(activeRequest, false);
					else refreshFn();
					return () => {
						if (sessions.get(id) !== session) return;
						sessions.delete(id);
						if (activeRequest?.sessions.includes(session))
							settleFn(activeRequest, false);
						else refreshFn();
					};
				},
				requestLeaveFn: (pathname) => {
					if (activeRequest !== undefined) return activeRequest.decision;
					const leaving = dirtySessionsFn(pathname);
					if (leaving.length === 0) return Promise.resolve(true);
					let resolveLeaveFn: (allow: boolean) => void = () => undefined;
					const decision = new Promise<boolean>((resolveFn) => {
						resolveLeaveFn = resolveFn;
					});
					const request = {
						decision,
						resolveFn: resolveLeaveFn,
						sessions: leaving,
					};
					activeRequest = request;
					void Promise.all(
						leaving.map((session) =>
							Promise.resolve()
								.then(() => session.isValidFn())
								.catch(() => false),
						),
					).then((validity) => {
						if (activeRequest !== request) return;
						publishFn({
							canSave: validity.every(Boolean),
							error: undefined,
							hasDirtySession: true,
							promptOpen: true,
							saving: false,
						});
					});
					return decision;
				},
				subscribeFn: (listenerFn) => {
					listeners.add(listenerFn);
					return () => listeners.delete(listenerFn);
				},
			};
		}),
);
