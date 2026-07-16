import { createContext } from "react";

import type { TileIdentity } from "~/ui/tile/TileIdentity";

export interface TilePointerSession extends TileIdentity {
	readonly pointerId: number;
}

export interface TileSystem {
	readonly active: TilePointerSession | null;
	readonly register: (identity: TileIdentity, node: HTMLElement | null) => void;
	readonly press: (session: TilePointerSession) => void;
	readonly release: (session: TilePointerSession) => void;
	readonly cancel: (identity: TileIdentity) => void;
}

/** Headless tile interaction context. It owns transient pointer state, never gameplay state. */
export const TileSystemContext = createContext<TileSystem | null>(null);
