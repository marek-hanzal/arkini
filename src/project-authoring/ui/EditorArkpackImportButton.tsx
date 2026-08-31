import { PackageOpen } from "lucide-react";
import { useRef } from "react";

import { Button } from "~/ui/ui/Button";

interface EditorArkpackImportButtonProps {
	readonly blocked: boolean;
	readonly pending: boolean;
	readonly onFileFn: (file: File | undefined) => void;
}

/** Opens the browser-native file picker for importing one arkpack. */
export const EditorArkpackImportButton = ({
	blocked,
	pending,
	onFileFn,
}: EditorArkpackImportButtonProps) => {
	const inputRef = useRef<HTMLInputElement>(null);

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept=".arkpack"
				className="hidden"
				disabled={blocked}
				onChange={(event) => {
					onFileFn(event.currentTarget.files?.[0]);
					event.currentTarget.value = "";
				}}
			/>
			<Button
				disabled={blocked}
				cursorIntent={pending ? "progress" : undefined}
				className="min-h-44 flex-col gap-3 rounded-2xl"
				onClick={() => inputRef.current?.click()}
				data-ui="EditorArkpackImportButton"
			>
				<PackageOpen className="size-9 text-accent" />
				<span className="text-lg">Import arkpack</span>
				<span className="text-xs font-medium opacity-75">
					Choose an existing .arkpack file
				</span>
			</Button>
		</>
	);
};
