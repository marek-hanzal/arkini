import { Tx } from "~/translation/ui/Tx";
import { Check } from "lucide-react";

/** Marks the end of a content section before its trailing scroll space. */
export const SectionEnd = () => (
	<div
		className="flex items-center justify-center gap-1.5 py-1 text-xs font-medium text-subtle"
		data-ui="SectionEnd"
	>
		<Check className="size-3.5" />
		<span>
			<Tx label="End of section" />
		</span>
	</div>
);
