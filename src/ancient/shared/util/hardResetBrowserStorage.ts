export const hardResetBrowserStorage = async () => {
	await (await navigator.storage.getDirectory()).remove({
		recursive: true,
	});
};
