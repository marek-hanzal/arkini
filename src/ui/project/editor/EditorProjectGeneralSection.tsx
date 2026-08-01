import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { useEditorProjectFormSession } from "~/ui/project/editor/EditorProjectFormContext";

const ReadOnlyProjectFact = ({
	label,
	value,
}: {
	readonly label: string;
	readonly value: string;
}) => (
	<div className="grid content-start gap-1.5 text-sm">
		<span className="font-semibold text-foreground">{label}</span>
		<span className="rounded-lg border border-line bg-canvas/50 px-3 py-2 font-mono text-muted">
			{value}
		</span>
	</div>
);

export const EditorProjectGeneralSection = () => {
	const { form, project } = useEditorProjectFormSession();
	return (
		<EditorFormSection
			title="General"
			description="Player-facing title and immutable project identity."
		>
			<form.AppField name="title">
				{(field) => <field.TextField label="Title" />}
			</form.AppField>
			<div className="grid gap-4 md:grid-cols-3">
				<ReadOnlyProjectFact
					label="Game ID"
					value={project.config.meta.id}
				/>
				<ReadOnlyProjectFact
					label="Workspace"
					value={project.projectId}
				/>
				<ReadOnlyProjectFact
					label="Schema version"
					value={project.config.version}
				/>
			</div>
		</EditorFormSection>
	);
};
