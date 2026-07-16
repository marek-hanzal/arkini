import { type PropsWithChildren, useCallback, useMemo, useRef, useState } from "react";

import type { TileIdentity } from "~/ui/tile/TileIdentity";
import { TileSystemContext, type TilePointerSession } from "~/ui/tile/TileSystemContext";

const isSameIdentity = (left: TileIdentity, right: TileIdentity) =>
	left.id === right.id && left.revision === right.revision;

/** Owns one transient pointer session and the mounted tile-node registry for a game tree. */
export const TileSystemProvider = ({ children }: PropsWithChildren) => {
	const nodes = useRef(
		new Map<
			string,
			{
				readonly revision: string;
				readonly node: HTMLElement;
			}
		>(),
	);
	const [active, setActive] = useState<TilePointerSession | null>(null);

	const register = useCallback((identity: TileIdentity, node: HTMLElement | null) => {
		if (node === null) {
			const registered = nodes.current.get(identity.id);
			if (registered?.revision === identity.revision) nodes.current.delete(identity.id);
			setActive((current) =>
				current !== null && isSameIdentity(current, identity) ? null : current,
			);
			return;
		}

		nodes.current.set(identity.id, {
			revision: identity.revision,
			node,
		});
	}, []);

	const press = useCallback((session: TilePointerSession) => {
		setActive((current) => {
			if (current !== null && current.pointerId !== session.pointerId) {
				const currentNode = nodes.current.get(current.id)?.node;
				if (currentNode?.hasPointerCapture(current.pointerId)) {
					currentNode.releasePointerCapture(current.pointerId);
				}
			}

			return session;
		});
	}, []);

	const release = useCallback((session: TilePointerSession) => {
		setActive((current) =>
			current !== null &&
			current.pointerId === session.pointerId &&
			isSameIdentity(current, session)
				? null
				: current,
		);
	}, []);

	const cancel = useCallback((identity: TileIdentity) => {
		setActive((current) =>
			current !== null && isSameIdentity(current, identity) ? null : current,
		);
	}, []);

	const value = useMemo(
		() => ({
			active,
			register,
			press,
			release,
			cancel,
		}),
		[
			active,
			cancel,
			press,
			register,
			release,
		],
	);

	return <TileSystemContext.Provider value={value}>{children}</TileSystemContext.Provider>;
};
