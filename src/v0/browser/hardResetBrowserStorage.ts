import { wipeDefaultDexieGameSaveStorage } from "~/v0/game/storage";

type OpfsStorageManager = StorageManager & {
	getDirectory?: () => Promise<{
		remove(options: { recursive: true }): Promise<void>;
	}>;
};

const wipeOpfsIfAvailable = async () => {
	const storage =
		typeof navigator === "undefined"
			? undefined
			: (navigator.storage as OpfsStorageManager | undefined);
	if (!storage?.getDirectory) return;

	await (await storage.getDirectory()).remove({
		recursive: true,
	});
};

const clearBestEffortKeyValueStorage = () => {
	try {
		globalThis.localStorage?.clear();
	} catch {
		// Hard reset is a recovery path; inaccessible localStorage should not block it.
	}

	try {
		globalThis.sessionStorage?.clear();
	} catch {
		// Same story, different browser drama.
	}
};

export const hardResetBrowserStorage = async () => {
	await wipeDefaultDexieGameSaveStorage();
	await wipeOpfsIfAvailable();
	clearBestEffortKeyValueStorage();
};
