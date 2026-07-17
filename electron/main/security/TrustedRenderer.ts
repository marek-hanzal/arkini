import type { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import type { Effect } from "effect";
import type { ElectronMainError } from "../ElectronMainError";

export interface TrustedRenderer {
	readonly developmentRendererUrl?: string;
	readonly isTrustedUrl: (candidate: string) => boolean;
	readonly isTrustedIpcSender: (event: IpcMainEvent | IpcMainInvokeEvent) => boolean;
	readonly assertTrustedIpcSenderFx: (
		event: IpcMainEvent | IpcMainInvokeEvent,
	) => Effect.Effect<void, ElectronMainError>;
	readonly registerWindowFx: (window: BrowserWindow) => Effect.Effect<void>;
}
