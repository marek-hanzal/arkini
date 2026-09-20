import { Tx } from "~/translation/ui/Tx";
import { PackageOpen } from "lucide-react";

import { Button } from "~/ui/ui/Button";

interface EditorSerapackImportButtonProps {
	readonly blocked: boolean;
	readonly pending: boolean;
	readonly onFileFn: () => void;
}

/** Opens the main-owned file picker for importing one Serapack. */
export const EditorSerapackImportButton = ({
	blocked,
	pending,
	onFileFn,
}: EditorSerapackImportButtonProps) => (
	<Button
		disabled={blocked}
		cursorIntent={pending ? "progress" : undefined}
		className="min-h-44 flex-col gap-3 rounded-2xl"
		onClick={onFileFn}
		data-ui="EditorSerapackImportButton"
	>
		<PackageOpen className="size-9 text-accent" />
		<span className="text-lg">
			<Tx label="Import serapack" />
		</span>
		<span className="text-xs font-medium opacity-75">
			<Tx label="Choose an existing .serapack file" />
		</span>
	</Button>
);
