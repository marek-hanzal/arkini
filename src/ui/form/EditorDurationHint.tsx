import { RendererRuntime } from "~/renderer/RendererRuntime";
import { formatEditorDurationFx } from "~/ui/form/formatEditorDurationFx";

export const EditorDurationHint = ({ seconds }: { readonly seconds: number }) => {
	const duration = RendererRuntime.runSync(formatEditorDurationFx(seconds));
	if (duration === undefined) return null;
	return (
		<span
			className="text-xs tabular-nums text-muted"
			data-ui="EditorDurationHint"
		>
			{duration}
		</span>
	);
};
