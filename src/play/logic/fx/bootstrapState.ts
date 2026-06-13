let bootstrapPromise: Promise<void> | undefined;
let migrationState: "pending" | "ready" = "pending";
let gameConfigHash = "pending";

export const bootstrapState = {
	get promise() {
		return bootstrapPromise;
	},
	set promise(value: Promise<void> | undefined) {
		bootstrapPromise = value;
	},
	get migration() {
		return migrationState;
	},
	set migration(value: typeof migrationState) {
		migrationState = value;
	},
	get configHash() {
		return gameConfigHash;
	},
	set configHash(value: string) {
		gameConfigHash = value;
	},
	reset() {
		bootstrapPromise = undefined;
		migrationState = "pending";
		gameConfigHash = "pending";
	},
};
