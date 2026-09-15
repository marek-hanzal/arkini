import { Tx } from "~/translation/ui/Tx";
import { PackageOpen } from "lucide-react";

import { Button } from "~/ui/ui/Button";

interface EditorArkpackImportButtonProps {
	readonly blocked: boolean;
	readonly pending: boolean;
	readonly onFileFn: () => void;
}

/** Opens the main-owned file picker for importing one Arkpack. */
export const EditorArkpackImportButton = ({
	blocked,
	pending,
	onFileFn,
}: EditorArkpackImportButtonProps) => (
	<Button
		disabled={blocked}
		cursorIntent={pending ? "progress" : undefined}
		className="min-h-44 flex-col gap-3 rounded-2xl"
		onClick={onFileFn}
		data-ui="EditorArkpackImportButton"
	>
		<PackageOpen className="size-9 text-accent" />
		<span className="text-lg">
			<Tx label="Import arkpack" />
		</span>
		<span className="text-xs font-medium opacity-75">
			<Tx label="Choose an existing .arkpack file" />
		</span>
	</Button>
);
