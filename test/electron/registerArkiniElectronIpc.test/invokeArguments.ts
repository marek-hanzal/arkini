import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";

const placeholderPackageId = "a".repeat(64);
export const saveKey = {
	packageId: "arkini",
} as const;

export const invokeArguments = new Map<string, ReadonlyArray<unknown>>([
	[
		ArkiniElectronApi.channels.appearanceRead,
		[],
	],
	[
		ArkiniElectronApi.channels.appearanceWrite,
		[
			"dark",
		],
	],
	[
		ArkiniElectronApi.channels.appearanceAccentRead,
		[],
	],
	[
		ArkiniElectronApi.channels.appearanceAccentWrite,
		[
			"rose",
		],
	],
	[
		ArkiniElectronApi.channels.cheatAvailabilityRead,
		[],
	],
	[
		ArkiniElectronApi.channels.cheatAvailabilityWrite,
		[
			false,
		],
	],
	[
		ArkiniElectronApi.channels.clipboardWriteText,
		[
			"https://example.com/editor/mcp",
		],
	],
	[
		ArkiniElectronApi.channels.launcherLastPackageIdRead,
		[],
	],
	[
		ArkiniElectronApi.channels.launcherLastPackageIdWrite,
		[
			"arkini",
		],
	],
	[
		ArkiniElectronApi.channels.localizationPreferredLanguagesRead,
		[],
	],
	[
		ArkiniElectronApi.channels.windowModeRead,
		[],
	],
	[
		ArkiniElectronApi.channels.windowModeWrite,
		[
			"fullscreen",
		],
	],
	[
		ArkiniElectronApi.channels.arkpackList,
		[],
	],
	[
		ArkiniElectronApi.channels.arkpackRead,
		[
			placeholderPackageId,
		],
	],
	[
		ArkiniElectronApi.channels.arkpackInstall,
		[
			{
				packageId: placeholderPackageId,
				bytes: new Uint8Array(),
			},
		],
	],
	[
		ArkiniElectronApi.channels.arkpackRemove,
		[
			placeholderPackageId,
		],
	],
	[
		ArkiniElectronApi.channels.arkpackOpenUserDirectory,
		[],
	],
	[
		ArkiniElectronApi.channels.saveRead,
		[
			saveKey,
		],
	],
	[
		ArkiniElectronApi.channels.saveWrite,
		[
			saveKey,
			new Uint8Array(),
		],
	],
	[
		ArkiniElectronApi.channels.saveClear,
		[
			saveKey,
		],
	],
	[
		ArkiniElectronApi.channels.diagnosticsWrite,
		[
			{
				level: "info",
				category: [
					"test",
				],
				event: "ipc-tested",
			},
		],
	],
	[
		ArkiniElectronApi.channels.diagnosticsOpenDirectory,
		[],
	],
	[
		ArkiniElectronApi.channels.incidentWrite,
		[
			{
				arkpackBytes: new Uint8Array(),
				saveBytes: new Uint8Array(),
				diagnostics: [
					{
						level: "info",
						category: [
							"game",
						],
						event: "session-started",
					},
					{
						level: "fatal",
						category: [
							"game",
						],
						event: "session-failed",
					},
				],
			},
		],
	],
	[
		ArkiniElectronApi.channels.userDataOpenDirectory,
		[],
	],
]);
