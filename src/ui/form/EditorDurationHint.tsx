import { formatEditorDurationFn } from "~/ui/form/fn/formatEditorDurationFn";

export const EditorDurationHint = ({ seconds }: { readonly seconds: number }) => {
	const duration = formatEditorDurationFn(seconds);
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
