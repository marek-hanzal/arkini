import { EditorValueField } from "~/editor-control/ui/EditorValueField";

export const ProjectGridSizeValue = ({
	height,
	width,
}: {
	readonly height: number;
	readonly width: number;
}) => {
	const size =
		Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0
			? width * height
			: "—";
	return (
		<EditorValueField
			as="div"
			label="Capacity"
		>
			<output className="flex min-h-[var(--ak-control-min-height)] items-center rounded-lg border border-control-border bg-canvas/50 px-3 py-2 font-mono text-muted">
				{size}
			</output>
		</EditorValueField>
	);
};
