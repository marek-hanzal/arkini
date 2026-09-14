import { Check } from "lucide-react";

/** Marks the structural end of one expanded branch in a complex editor form. */
export const EditorFormBranchEnd = () => (
	<div
		className="flex items-center justify-center gap-1.5 py-1 text-xs font-medium text-subtle"
		data-ui="EditorFormBranchEnd"
	>
		<Check className="size-3.5" />
		<span>Done</span>
	</div>
);
