import { LoaderCircle } from "lucide-react";

import { Status } from "~/ui/ui/Status";

/** Keeps the item and catalog Estimate wait state visually identical. */
export const ItemEstimateLoading = ({ catalog = false }: { readonly catalog?: boolean }) => (
	<Status
		dataUi={catalog ? "EditorItemEstimatesLoading" : "EditorItemEstimateLoading"}
		description="Analyzing authored routes and their requirements."
		icon={LoaderCircle}
		iconSpin
		title={catalog ? "Calculating all item estimates" : "Calculating estimate"}
	/>
);
