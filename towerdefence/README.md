# API conventions

# Signing Transactions
Each transaction should contains a structure of msg, pubkey, sign. The msg is a bignumber that is equivalent to a u64 array of length 4. This msg should be used to encode all the information of a user command. The pkx and pky are the pubkey of the user and the sig(x,y,r) is the signature of msg using the privateky that is related to the pubkey.

Please **use** the following tested function to sign a transaction:
```
export function sign(cmd: Array<bigint>, prikey: string) {
  let pkey = PrivateKey.fromString(prikey);
  let r = pkey.r();
  let R = Point.base.mul(r);
  let H = cmd[0] + (cmd[1] << 64n) + (cmd[2] << 128n) + (cmd[3] << 196n);
  let hbn = new BN(H.toString(10));
  let S = r.add(pkey.key.mul(new CurveField(hbn)));
  let pubkey = pkey.publicKey;
  const data = {
    msg: bnToHexLe(hbn),
    pkx: bnToHexLe(pubkey.key.x.v),
    pky: bnToHexLe(pubkey.key.y.v),
    sigx: bnToHexLe(R.x.v),
    sigy: bnToHexLe(R.y.v),
    sigr: bnToHexLe(S.v),
  };
  return data;
}
```

## Message encoding
Place Tower:
[TowerID: u64, Position: u64 = [u32, u32], reserved = 0, command = 0]

Remove Tower:
[TowerID: u64, Position: u64 = [u32, u32], reserved = 0, command = 1]

Upgrade Tower:
[TowerID: u64, Recipie: u64, reserved = 0, command = 2]

Place Modifier:
[Modifier: u64, Position: u64, reserved = 0, command = 3]

Remove Modifier:
[Modifier: u64, Position: u64, reserved = 0, command = 4]

## State Encoding
see https://github.com/DelphinusLab/towerdefence-demo/blob/main/src/game/state.rs#L43
