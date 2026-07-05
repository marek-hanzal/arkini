import { match } from "ts-pattern";
import type { LineView } from "~/board/view/LineViewSchema";
import type { RuntimeLineDefaultSelection } from "~/play/game-engine-bridge/readRuntimeLineDefaultSelection";

export namespace readRuntimeLineIsSelectedDefault {
	export interface Props {
		defaultSelection: RuntimeLineDefaultSelection;
		kind: LineView["kind"];
		lineId: string;
	}
}

export const readRuntimeLineIsSelectedDefault = ({
	defaultSelection,
	kind,
	lineId,
}: readRuntimeLineIsSelectedDefault.Props) =>
	match(kind)
		.with("effect", () => lineId === defaultSelection.selectedDefaultEffectLineId)
		.with("product", () => lineId === defaultSelection.selectedDefaultProductLineId)
		.exhaustive();
