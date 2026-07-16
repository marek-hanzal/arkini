import { Data } from "effect";

class GameRuntimeConfigLoadFailedError extends Data.TaggedError("GameRuntimeConfigLoadFailed")<{
	readonly cause: unknown;
}> {}

class GameRuntimeConfigHashFailedError extends Data.TaggedError("GameRuntimeConfigHashFailed")<{
	readonly cause: unknown;
}> {}

class GameRuntimeStorageLoadFailedError extends Data.TaggedError("GameRuntimeStorageLoadFailed")<{
	readonly cause: unknown;
}> {}

class GameRuntimeStorageSaveFailedError extends Data.TaggedError("GameRuntimeStorageSaveFailed")<{
	readonly cause: unknown;
}> {}

class GameRuntimeAdapterCreateFailedError extends Data.TaggedError(
	"GameRuntimeAdapterCreateFailed",
)<{
	readonly cause: unknown;
}> {}

class GameRuntimeStoreCreateFailedError extends Data.TaggedError("GameRuntimeStoreCreateFailed")<{
	readonly cause: unknown;
}> {}

export type GameRuntimeStartupError =
	| GameRuntimeConfigLoadFailedError
	| GameRuntimeConfigHashFailedError
	| GameRuntimeStorageLoadFailedError
	| GameRuntimeStorageSaveFailedError
	| GameRuntimeAdapterCreateFailedError
	| GameRuntimeStoreCreateFailedError;

export const GameRuntimeStartupError = {
	adapterCreateFailed(cause: unknown): GameRuntimeStartupError {
		return new GameRuntimeAdapterCreateFailedError({
			cause,
		});
	},
	configHashFailed(cause: unknown): GameRuntimeStartupError {
		return new GameRuntimeConfigHashFailedError({
			cause,
		});
	},
	configLoadFailed(cause: unknown): GameRuntimeStartupError {
		return new GameRuntimeConfigLoadFailedError({
			cause,
		});
	},
	storageLoadFailed(cause: unknown): GameRuntimeStartupError {
		return new GameRuntimeStorageLoadFailedError({
			cause,
		});
	},
	storageSaveFailed(cause: unknown): GameRuntimeStartupError {
		return new GameRuntimeStorageSaveFailedError({
			cause,
		});
	},
	storeCreateFailed(cause: unknown): GameRuntimeStartupError {
		return new GameRuntimeStoreCreateFailedError({
			cause,
		});
	},
};
