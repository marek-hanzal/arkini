import { createContext, type PropsWithChildren, useContext } from "react";

import type { useSettingsModel } from "~/ui/settings/useSettingsModel";

type SettingsModel = ReturnType<typeof useSettingsModel>;

const SettingsModelContext = createContext<SettingsModel | undefined>(undefined);

export const SettingsModelProvider = ({
	children,
	model,
}: PropsWithChildren<{
	readonly model: SettingsModel;
}>) => <SettingsModelContext value={model}>{children}</SettingsModelContext>;

export const useSettingsModelContext = () => {
	const model = useContext(SettingsModelContext);
	if (model === undefined) throw new Error("Settings model is unavailable.");
	return model;
};
