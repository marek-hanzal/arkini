import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { EditorCollectionOption } from "~/editor-control/ui/EditorCollectionOption";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Identifies a merge by its receiving item and separate target/source behavior. */
export const MergeOption = ({
	label,
	merge,
	target,
}: {
	readonly label: string;
	readonly merge: MergeSchema.Type;
	readonly target: ItemSchema.Type | undefined;
}) => {
	const translator = useTranslator();
	const effects = {
		keep: translator.textFn("Keep"),
		remove: translator.textFn("Remove"),
		spend: translator.textFn("Spend"),
		replace: translator.textFn("Replace"),
	};
	const actions = {
		use: translator.textFn("Use"),
		consume: translator.textFn("Consume"),
		spend: translator.textFn("Spend"),
	};
	return (
		<EditorCollectionOption
			label={label}
			details={
				<span className="text-xs text-subtle">
					{translator.textFn("Target effect")}:{" "}
					<strong className="font-bold text-foreground">{effects[merge.effect]}</strong>
					{" · "}
					{translator.textFn("Source action")}:{" "}
					<strong className="font-bold text-foreground">{actions[merge.action]}</strong>
				</span>
			}
		>
			<EditorItemThumbnail
				size="md"
				className="rounded-md"
				resourceIds={
					target?.artwork.default ?? [
						"",
					]
				}
			/>
		</EditorCollectionOption>
	);
};
