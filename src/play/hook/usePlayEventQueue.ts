import { asyncQueue } from "@tanstack/pacer";
import { useCallback, useMemo } from "react";

interface QueuedGameEvent<T = unknown> {
	label: string;
	run(): Promise<T> | T;
	resolve(value: T): void;
	reject(error: unknown): void;
}

export function usePlayEventQueue() {
	const queue = useMemo(
		() =>
			asyncQueue<QueuedGameEvent>(
				async (event) => {
					try {
						event.resolve(await event.run());
					} catch (error) {
						event.reject(error);
					}
				},
				{
					concurrency: 1,
					started: true,
					key: "arkini-game-event-queue",
				},
			),
		[],
	);

	return useCallback(
		<T>(label: string, run: () => Promise<T> | T) =>
			new Promise<T>((resolve, reject) => {
				const accepted = queue({
					label,
					run,
					resolve: resolve as (value: unknown) => void,
					reject,
				});
				if (!accepted) reject(new Error(`Game event queue rejected '${label}'.`));
			}),
		[
			queue,
		],
	);
}
