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
		readonly clearSave: (game: Game) => Promise<void>;
	}

	export interface Owner {
		readonly getSnapshot: () => State;
		readonly replace: (packageId: string | null) => Promise<void>;
		readonly hardReset: () => Promise<void>;
		readonly subscribe: (listener: () => void) => () => void;
	}
}

/** Serializes one shell's exclusive ownership of replaceable live game instances. */
export const createGameOwner = ({
	create,
	clearSave,
}: createGameOwner.Props): createGameOwner.Owner => {
	const listeners = new Set<() => void>();
	let requestedPackageId: string | null = null;
	let requestedHardReset = false;
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
				const hardReset = requestedHardReset && packageId === releasing.arkpack.packageId;
				try {
					if (hardReset) {
						await releasing.disposeWithoutSave();
						await clearSave(releasing);
						requestedHardReset = false;
					} else {
						await releasing.dispose();
					}
				} catch (error) {
					fail(requestVersion, error);
					return;
				}
				continue;
			}

			if (packageId === null) {
				settledVersion = version;
				publish({
					type: "loading",
					packageId: null,
				});
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
				!requestedHardReset &&
				packageId === requestedPackageId &&
				settledVersion === requestVersion &&
				((packageId === null &&
					current === undefined &&
					state.type === "loading" &&
					state.packageId === null) ||
					(packageId !== null &&
						current?.arkpack.packageId === packageId &&
						state.type === "ready"))
			) {
				return Promise.resolve();
			}
			requestedPackageId = packageId;
			requestedHardReset = false;
			requestVersion += 1;
			if (packageId !== null)
				publish({
					type: "loading",
					packageId,
				});
			return ensureRunning();
		},
		hardReset: () => {
			if (requestedHardReset) return ensureRunning();
			if (current === undefined || state.type !== "ready") {
				return Promise.reject(new Error("A ready game is required for hard reset."));
			}
			requestedPackageId = current.arkpack.packageId;
			requestedHardReset = true;
			requestVersion += 1;
			publish({
				type: "loading",
				packageId: requestedPackageId,
			});
			return ensureRunning();
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
};
