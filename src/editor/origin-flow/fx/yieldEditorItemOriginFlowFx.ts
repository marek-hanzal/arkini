import { Effect } from "effect";

/** Cooperatively returns editor flow construction to the renderer and remains interruptible. */
export const yieldEditorItemOriginFlowFx = Effect.fn("yieldEditorItemOriginFlowFx")(() =>
	Effect.promise(async (signal) => {
		const abortCause = () => signal.reason ?? new Error("Acquisition graph build interrupted.");
		if (signal.aborted) throw abortCause();
		let interrupt: (() => void) | undefined;
		const interruption = new Promise<never>((_, reject) => {
			interrupt = () => reject(abortCause());
			signal.addEventListener("abort", interrupt, {
				once: true,
			});
		});
		const continuation =
			typeof globalThis.scheduler === "undefined"
				? new Promise<void>((resolve) => setTimeout(resolve, 0))
				: globalThis.scheduler.postTask(() => undefined, {
						priority: "background",
					});
		try {
			await Promise.race([
				continuation,
				interruption,
			]);
			if (signal.aborted) throw abortCause();
		} finally {
			if (interrupt !== undefined) signal.removeEventListener("abort", interrupt);
		}
	}),
);
