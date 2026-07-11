# V1 rule availability naming

V1 availability rules use one symmetric vocabulary across domains:

- `show` / `hide` control visibility where the domain exposes visibility.
- `enable` / `disable` control availability.
- Legacy `require` / `block` discriminators are not accepted by V1 schemas.

For line and drop availability, every configured `enable` rule is a positive gate and an applicable `disable` rule is a veto. The next drop-runtime pass should mirror the schema hierarchy with dedicated rule Fx leaves and compose them through `whenFx`.

V0 remains unchanged and is only a behavioral reference.
