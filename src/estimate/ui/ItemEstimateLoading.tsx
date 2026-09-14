import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
import { LoaderCircle } from "lucide-react";

import { Status } from "~/ui/ui/Status";

/** Keeps the item and catalog Estimate wait state visually identical. */
export const ItemEstimateLoading = ({ catalog = false }: { readonly catalog?: boolean }) => (
	<Status
		dataUi={catalog ? "EditorItemEstimatesLoading" : "EditorItemEstimateLoading"}
		description={<Mx label="Estimate loading description" />}
		icon={LoaderCircle}
		iconSpin
		title={<Tx label={catalog ? "Calculating all item estimates" : "Calculating estimate"} />}
	/>
);
