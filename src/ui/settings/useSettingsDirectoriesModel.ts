import { useAtom } from "@effect/atom-react";

import { SettingsDiagnosticsCommandAtom } from "~/ui/settings/SettingsDiagnosticsCommandAtom";
import { SettingsUserDataCommandAtom } from "~/ui/settings/SettingsUserDataCommandAtom";

export const useSettingsDirectoriesModel = () => {
	const [diagnosticsStatus, openDiagnosticsCommand] = useAtom(SettingsDiagnosticsCommandAtom);
	const [userDataStatus, openUserDataCommand] = useAtom(SettingsUserDataCommandAtom);

	return {
		diagnosticsStatus,
		userDataStatus,
		openDiagnostics: () => openDiagnosticsCommand(undefined),
		openUserData: () => openUserDataCommand(undefined),
	};
};

export type SettingsDirectoriesModel = ReturnType<typeof useSettingsDirectoriesModel>;
