import { Deferred, Effect } from "effect";

interface EditorProjectSessionState {
	acceptingCanonical: boolean;
	canonicalPending: number;
	canonicalIdle: Deferred.Deferred<void>;
}

const sessions = new Map<string, EditorProjectSessionState>();
let activeProjectId: string | undefined;

const readSession = (projectId: string) => {
	const existing = sessions.get(projectId);
	if (existing !== undefined) return existing;
	const created: EditorProjectSessionState = {
		acceptingCanonical: true,
		canonicalPending: 0,
		canonicalIdle: Deferred.makeUnsafe<void>(),
	};
	Deferred.doneUnsafe(created.canonicalIdle, Effect.void);
	sessions.set(projectId, created);
	return created;
};

export const openEditorProjectSession = (projectId: string) => {
	const session = readSession(projectId);
	session.acceptingCanonical = true;
	activeProjectId = projectId;
};

export const resumeEditorProjectSession = (projectId: string) => {
	const session = readSession(projectId);
	session.acceptingCanonical = true;
	activeProjectId = projectId;
};

export const readActiveEditorProjectId = () => activeProjectId;

export const admitEditorProjectCanonicalMutation = (projectId: string) => {
	const session = readSession(projectId);
	if (!session.acceptingCanonical) return undefined;
	if (session.canonicalPending === 0) {
		session.canonicalIdle = Deferred.makeUnsafe<void>();
	}
	session.canonicalPending += 1;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		session.canonicalPending = Math.max(0, session.canonicalPending - 1);
		if (session.canonicalPending === 0) {
			Deferred.doneUnsafe(session.canonicalIdle, Effect.void);
		}
	};
};

export const beginEditorProjectCanonicalClose = (projectId: string) => {
	const session = readSession(projectId);
	session.acceptingCanonical = false;
	return session.canonicalPending === 0 ? Effect.void : Deferred.await(session.canonicalIdle);
};

export const releaseEditorProjectSession = (projectId: string) => {
	const session = sessions.get(projectId);
	if (session?.canonicalPending === 0) {
		sessions.delete(projectId);
	}
	if (activeProjectId === projectId) activeProjectId = undefined;
};
