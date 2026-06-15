import type { ItemId } from "~/v0/manifest/manifestId";

export namespace craftInputStorageKey {
	export interface Props {
		ownerItemInstanceId: string;
		itemId: ItemId;
	}
}

export const craftInputStorageKey = ({ ownerItemInstanceId, itemId }: craftInputStorageKey.Props) =>
	`${ownerItemInstanceId}:craft-input:${itemId}`;
