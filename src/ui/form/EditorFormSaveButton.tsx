import { PrimaryButton } from "~/ui/button/Button";

export const EditorFormSaveButton = ({
	dirty,
	saving,
	save,
}: {
	readonly dirty: boolean;
	readonly saving: boolean;
	readonly save: () => Promise<boolean>;
}) => (
	<PrimaryButton
		type="button"
		className="min-h-0 px-4 py-2"
		disabled={!dirty || saving}
		cursorIntent={saving ? "progress" : undefined}
		onClick={() => void save().catch(() => undefined)}
	>
		Save
	</PrimaryButton>
);
