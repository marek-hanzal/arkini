import type { Game } from "~/bridge/game/Game";

export namespace createGameOwner {
	export type State =
		| {
				readonly type: "loading";
				readonly packageId: string | null;
		  }
		| {
				readonly type: "ready";
				readonly game: Game;
		  }
		| {
				readonly type: "failed";
				readonly packageId: string | null;
				readonly error: unknown;
		  };

	export interface Props {
		readonly create: (packageId: string) => Promise<Game>;
	}

	export interface Owner {
		readonly getSnapshot: () => State;
		readonly replace: (packageId: string | null) => Promise<void>;
		readonly subscribe: (listener: () => void) => () => void;
	}
}

/** Serializes one shell's exclusive ownership of replaceable live game instances. */
export const createGameOwner = ({ create }: createGameOwner.Props): createGameOwner.Owner => {
	const listeners = new Set<() => void>();
	let requestedPackageId: string | null = null;
	let requestVersion = 0;
	let settledVersion = 0;
	let current: Game | undefined;
	let running: Promise<void> | undefined;
	let state: createGameOwner.State = {
		type: "loading",
		packageId: null,
	};

	const publish = (next: createGameOwner.State) => {
		state = next;
		for (const listener of listeners) listener();
	};

	const fail = (version: number, error: unknown) => {
		settledVersion = version;
		publish({
			type: "failed",
			packageId: requestedPackageId,
			error,
		});
	};

	const drain = async () => {
		while (settledVersion !== requestVersion) {
			const version = requestVersion;
			const packageId = requestedPackageId;

			if (current !== undefined) {
				const releasing = current;
				current = undefined;
				try {
					await releasing.dispose();
				} catch (error) {
					fail(requestVersion, error);
					return;
				}
				continue;
			}

			if (packageId === null) {
				settledVersion = version;
				return;
			}

			publish({
				type: "loading",
				packageId,
			});

			let created: Game;
			try {
				created = await create(packageId);
			} catch (error) {
				if (version !== requestVersion) continue;
				fail(version, error);
				return;
			}

			if (version !== requestVersion || requestedPackageId !== packageId) {
				try {
					await created.dispose();
				} catch (error) {
					fail(requestVersion, error);
					return;
				}
				continue;
			}

			current = created;
			settledVersion = version;
			publish({
				type: "ready",
				game: created,
			});
		}
	};

	const ensureRunning = () => {
		if (running === undefined) {
			running = drain().finally(() => {
				running = undefined;
				if (settledVersion !== requestVersion) void ensureRunning();
			});
		}
		return running;
	};

	return {
		getSnapshot: () => state,
		replace: (packageId) => {
			if (
				packageId === requestedPackageId &&
				settledVersion === requestVersion &&
				((packageId === null && current === undefined) ||
					(packageId !== null &&
						current?.arkpack.packageId === packageId &&
						state.type === "ready"))
			) {
				return Promise.resolve();
			}

			requestedPackageId = packageId;
			requestVersion += 1;
			if (packageId !== null) {
				publish({
					type: "loading",
					packageId,
				});
			}
			return ensureRunning();
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
};
