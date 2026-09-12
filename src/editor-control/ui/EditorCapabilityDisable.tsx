import { Trash2 } from "lucide-react";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { LinkButton } from "~/ui/ui/LinkButton";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Removes a whole optional capability from the draft, with its impact beside the action. */
export const EditorCapabilityDisable = ({
	title,
	description,
	onDisableFn,
}: {
	readonly title: string;
	readonly description: string;
	readonly onDisableFn: () => void;
}) => {
	const translator = useTranslator();
	return (
		<EditorFormCard>
			<EditorFormSectionDivider
				title={translator.textFn("Status")}
				description={description}
				variant="secondary"
			/>
			<div className="flex items-center justify-between gap-3">
				<span className="text-sm font-medium">{title}</span>
				<LinkButton
					className="inline-flex items-center gap-1.5"
					onClick={onDisableFn}
				>
					<Trash2 className="size-4" />
					{translator.textFn("Disable")}
				</LinkButton>
			</div>
		</EditorFormCard>
	);
};
