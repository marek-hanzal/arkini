import { createContext } from "react";

export interface CheatItemSpawnControl {
	readonly error: unknown;
	readonly isError: boolean;
	readonly isSuccess: boolean;
	readonly pending: boolean;
	readonly request: (itemId: string) => boolean;
	readonly reset: () => void;
}

export const CheatItemSpawnContext = createContext<CheatItemSpawnControl | null>(null);
