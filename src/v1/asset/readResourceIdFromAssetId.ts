/**
 * Converts a canonical asset ID into the resource ID emitted by the packer.
 *
 * Asset IDs use namespaced colon separators while packed PNG resources keep
 * their source filename without the extension.
 */
export const readResourceIdFromAssetId = (assetId: string): string =>
	assetId.replace(/^asset:/u, "").replaceAll(":", "-");
