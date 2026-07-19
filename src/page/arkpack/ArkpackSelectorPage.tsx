import { ArkpackSelector } from "~/ui/arkpack/ArkpackSelector";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";

export function ArkpackSelectorPage() {
	return (
		<MainPageLayout
			labelledBy="arkpack-selector-title"
			page="arkpacks"
			panelMode="viewport"
		>
			<ArkpackSelector />
		</MainPageLayout>
	);
}
