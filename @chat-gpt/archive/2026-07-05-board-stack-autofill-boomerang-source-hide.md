# Board stack autofill boomerang source hide

Fixed the partial board stack autofill visual path where the runtime keeps a reduced stack on the original board cell while the UI animates the full stack as a boomerang into the producer/craft target and back.

The transient board tile now carries `hiddenBoardItemId` for boomerang stack input-store visuals. Board surface tile derivation hides the matching live board item until the transient group is cleaned up, preventing a reduced-count placeholder from being visible underneath the boomerang animation.

Validated with targeted visual plan and board surface tile tests.
