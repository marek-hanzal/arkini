import { useTranslator } from "~/translation/ui/useTranslator";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import { EditorCollectionOption } from "~/editor-control/ui/EditorCollectionOption";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";

/** Lists possible emitted identities, not condition references or guaranteed runtime outcomes. */
export const OutcomeOption = ({
	label,
	outcomes,
	summary,
}: {
	readonly label: string;
	readonly outcomes: readonly OutcomeSchema.Type[];
	readonly summary?: string;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const ids = [
		...new Set(
			outcomes.flatMap((outcome) =>
				outcome.type === "item"
					? [
							outcome.itemId,
						]
					: [],
			),
		),
	];
	return (
		<EditorCollectionOption
			label={label}
			details={
				summary === undefined ? undefined : (
					<span className="text-xs text-subtle">{summary}</span>
				)
			}
		>
			{outcomes
				.filter((outcome) => outcome.type === "space")
				.map((outcome, index) => (
					<span
						key={`space:${index}`}
						className="text-xs"
					>
						{translator.textFn("Space")} {outcome.space}
					</span>
				))}
			{ids.map((id) => (
				<EditorItemThumbnail
					key={id}
					size="md"
					className="rounded-md"
					resourceIds={
						project.config.items[id]?.artwork.default ?? [
							"",
						]
					}
				/>
			))}
		</EditorCollectionOption>
	);
};
