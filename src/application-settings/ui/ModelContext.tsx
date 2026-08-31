import { createContext, type PropsWithChildren, useContext } from "react";

import type { useSettingsModel } from "~/application-settings/ui/useSettingsModel";

const ModelContext = createContext<useSettingsModel.Output | undefined>(undefined);

export const ModelProvider = ({
	children,
	model,
}: PropsWithChildren<{
	readonly model: useSettingsModel.Output;
}>) => <ModelContext value={model}>{children}</ModelContext>;

export const useModelContext = () => {
	const model = useContext(ModelContext);
	if (model === undefined) throw new Error("Settings model is unavailable.");
	return model;
};
