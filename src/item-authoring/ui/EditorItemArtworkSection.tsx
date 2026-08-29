import { useState } from "react";

import { EditorFormCard } from "~/ui/form/EditorFormCard";
import { EditorItemArtworkFields } from "~/item-authoring/ui/EditorItemArtworkFields";
import { EditorItemArtworkPreview } from "~/item-authoring/ui/EditorItemArtworkPreview";
import { useEditorItemFormSession } from "~/item-authoring/ui/EditorItemFormContext";

export const EditorItemArtworkSection = () => {
	const { form } = useEditorItemFormSession();
	const [selectedProgressIndex, setSelectedProgressIndex] = useState(0);
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormCard>
				<EditorItemArtworkFields
					form={form}
					fields="asset"
					onSelectedProgressIndexChange={setSelectedProgressIndex}
					selectedProgressIndex={selectedProgressIndex}
				/>
			</EditorFormCard>
			<form.Subscribe selector={(state) => state.values.asset}>
				{(asset) => (
					<EditorItemArtworkPreview
						asset={asset}
						onSelectProgress={setSelectedProgressIndex}
						selectedProgressIndex={selectedProgressIndex}
					/>
				)}
			</form.Subscribe>
		</div>
	);
};
