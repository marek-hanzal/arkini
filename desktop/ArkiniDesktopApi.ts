export namespace ArkiniDesktopApi {
	export const channels = {
		arkpackList: "arkini:arkpack:list",
		arkpackRead: "arkini:arkpack:read",
		arkpackInstall: "arkini:arkpack:install",
		arkpackRemove: "arkini:arkpack:remove",
		saveRead: "arkini:save:read",
		saveWrite: "arkini:save:write",
		saveClear: "arkini:save:clear",
		beforeClose: "arkini:lifecycle:before-close",
		closeReady: "arkini:lifecycle:close-ready",
		closeFailed: "arkini:lifecycle:close-failed",
	} as const;

	export interface ArkpackDescriptor {
		readonly packageId: string;
		readonly contentHash: string;
		readonly gameId: string;
		readonly title: string;
		readonly configVersion: string;
		readonly compressedSize: number;
		readonly source: "imported";
		readonly filename?: string;
		readonly importedAtMs?: number;
	}

	export interface ArkpackRecord {
		readonly descriptor: ArkpackDescriptor;
		readonly bytes: Uint8Array;
	}

	export interface SaveKey {
		readonly packageId: string;
		readonly contentHash: string;
	}

	export interface Api {
		readonly arkpack: {
			readonly list: () => Promise<ReadonlyArray<ArkpackDescriptor>>;
			readonly read: (packageId: string) => Promise<ArkpackRecord | null>;
			readonly install: (record: ArkpackRecord) => Promise<void>;
			readonly remove: (packageId: string) => Promise<void>;
		};
		readonly save: {
			readonly read: (key: SaveKey) => Promise<Uint8Array | null>;
			readonly write: (key: SaveKey, bytes: Uint8Array) => Promise<void>;
			readonly clear: (key: SaveKey) => Promise<void>;
		};
		readonly lifecycle: {
			readonly onBeforeClose: (listener: () => Promise<void>) => () => void;
		};
	}
}

declare global {
	interface Window {
		readonly arkini?: ArkiniDesktopApi.Api;
	}
}
