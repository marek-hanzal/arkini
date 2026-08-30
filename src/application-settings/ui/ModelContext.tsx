import { createContext, type PropsWithChildren, useContext } from "react";

import type { useSettingsModel } from "~/application-settings/ui/useSettingsModel";

type SettingsModel = ReturnType<typeof useSettingsModel>;

const ModelContext = createContext<SettingsModel | undefined>(undefined);

export const ModelProvider = ({
	children,
	model,
}: PropsWithChildren<{
	readonly model: SettingsModel;
}>) => <ModelContext value={model}>{children}</ModelContext>;

export const useModelContext = () => {
	const model = useContext(ModelContext);
	if (model === undefined) throw new Error("Settings model is unavailable.");
	return model;
};
