export const hardResetBrowserStorage = async () => {
	await (
		(await navigator.storage.getDirectory()) as FileSystemDirectoryHandle & {
			remove(options: { recursive: boolean }): Promise<void>;
		}
	).remove({
		recursive: true,
	});
};
