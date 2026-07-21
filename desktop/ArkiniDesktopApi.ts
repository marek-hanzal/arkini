import type { AppearanceAccentSchema } from "./appearance/AppearanceAccentSchema";
import type { AppearanceThemeSchema } from "./appearance/AppearanceThemeSchema";
import type { CheatAvailabilitySchema } from "./cheat/CheatAvailabilitySchema";

export namespace ArkiniDesktopApi {
	export const channels = {
		arkpackList: "arkini:arkpack:list",
		arkpackRead: "arkini:arkpack:read",
		arkpackInstall: "arkini:arkpack:install",
		arkpackRemove: "arkini:arkpack:remove",
		saveRead: "arkini:save:read",
		saveWrite: "arkini:save:write",
		saveClear: "arkini:save:clear",
		appearanceRead: "arkini:appearance:read",
		appearanceWrite: "arkini:appearance:write",
		appearanceAccentRead: "arkini:appearance:accent:read",
		appearanceAccentWrite: "arkini:appearance:accent:write",
		cheatAvailabilityRead: "arkini:cheats:available:read",
		cheatAvailabilityWrite: "arkini:cheats:available:write",
		windowVisible: "arkini:lifecycle:window-visible",
		beforeClose: "arkini:lifecycle:before-close",
		closeReady: "arkini:lifecycle:close-ready",
		closeFailed: "arkini:lifecycle:close-failed",
		requestClose: "arkini:lifecycle:request-close",
		forceClose: "arkini:lifecycle:force-close",
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
		readonly appearance: {
			readonly read: () => Promise<AppearanceThemeSchema.Type>;
			readonly write: (theme: AppearanceThemeSchema.Type) => Promise<void>;
			readonly readAccent: () => Promise<AppearanceAccentSchema.Type>;
			readonly writeAccent: (accent: AppearanceAccentSchema.Type) => Promise<void>;
		};
		readonly cheats: {
			readonly readAvailable: () => Promise<CheatAvailabilitySchema.Type>;
			readonly writeAvailable: (available: CheatAvailabilitySchema.Type) => Promise<void>;
		};
		readonly save: {
			readonly read: (key: SaveKey) => Promise<Uint8Array | null>;
			readonly write: (key: SaveKey, bytes: Uint8Array) => Promise<void>;
			readonly clear: (key: SaveKey) => Promise<void>;
		};
		readonly lifecycle: {
			readonly waitUntilVisible: () => Promise<number>;
			readonly onBeforeClose: (listener: () => Promise<void>) => () => void;
			readonly onBeforeCloseReady: (listener: () => Promise<void>) => () => void;
			readonly onCloseFailed: (listener: (error: unknown) => void) => () => void;
			readonly requestClose: () => Promise<void>;
			readonly forceClose: () => void;
		};
	}
}

declare global {
	interface Window {
		readonly arkini: ArkiniDesktopApi.Api;
	}
}
