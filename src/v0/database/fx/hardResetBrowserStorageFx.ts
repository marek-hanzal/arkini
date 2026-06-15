import { Effect } from "effect";

export const hardResetBrowserStorageFx = Effect.promise(async () => {
	await (await navigator.storage.getDirectory()).remove({
		recursive: true,
	});
});
