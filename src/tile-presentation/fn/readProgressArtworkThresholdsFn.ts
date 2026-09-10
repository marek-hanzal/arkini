import { TypeSchema } from "~/item-definition/schema/TypeSchema";

/** Returns the runtime progress threshold that activates each authored progress asset. */
export const readProgressArtworkThresholdsFn = ({
	itemType,
	sourceCount,
}: {
	readonly itemType: TypeSchema.Type;
	readonly sourceCount: number;
}) => {
	const intervalCount = itemType === TypeSchema.enum.Temporary ? sourceCount + 1 : sourceCount;
	return Array.from(
		{
			length: sourceCount,
		},
		(_, index) => (index + 1) / intervalCount,
	);
};
