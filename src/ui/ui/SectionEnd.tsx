import { Tx } from "~/translation/ui/Tx";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

/** Marks the end of a content section before its trailing scroll space. */
export const SectionEnd = ({ children }: { readonly children?: ReactNode }) => (
	<div
		className="flex items-center justify-center gap-1.5 py-1 text-xs font-medium text-subtle"
		data-ui="SectionEnd"
	>
		<Check className="size-3.5" />
		<span>
			{children ?? <Tx label="End of section" />}
		</span>
	</div>
);
