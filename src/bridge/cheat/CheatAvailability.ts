/** Renderer-wide application preference exposing save-scoped cheat tooling. */
export interface CheatAvailability {
	readonly getSnapshot: () => boolean;
	readonly apply: (available: boolean) => void;
	readonly waitUntilReady: () => Promise<void>;
	readonly subscribe: (listener: () => void | PromiseLike<void>) => () => void;
}
