// BadgeSigner adapter: Ed25519 with node:crypto. Also the reference verifier that any third party can run.

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";
import type { BadgeSigner, PublicJwk } from "../application/ports.ts";
import { signedBytes, type Badge } from "../domain/badge.ts";

function b64url(bytes: Buffer | Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export class Ed25519Signer implements BadgeSigner {
  readonly kid: string;
  readonly publicJwk: PublicJwk;
  private readonly privateKey: KeyObject;

  constructor(privateKey: KeyObject) {
    if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("The signing key must be an Ed25519 private key.");
    this.privateKey = privateKey;
    const jwk = createPublicKey(privateKey).export({ format: "jwk" }) as { x: string };
    this.kid = b64url(createHash("sha256").update(Buffer.from(jwk.x, "base64url")).digest()).slice(0, 16);
    this.publicJwk = { kty: "OKP", crv: "Ed25519", x: jwk.x, kid: this.kid, use: "sig", alg: "EdDSA" };
  }

  static fromPem(pem: string): Ed25519Signer {
    return new Ed25519Signer(createPrivateKey(pem));
  }

  static ephemeral(): Ed25519Signer {
    return new Ed25519Signer(generateKeyPairSync("ed25519").privateKey);
  }

  sign(bytes: string): string {
    return b64url(sign(null, Buffer.from(bytes), this.privateKey));
  }

  badgeId(bytes: string): string {
    return b64url(createHash("sha256").update(bytes).digest()).slice(0, 22);
  }
}

/** Verify a badge against a public JWK: id and Ed25519 signature over the canonical payload. */
export function verifyBadgeSignature(badge: Pick<Badge, "id" | "payload" | "signature">, jwk: { x: string; kid?: string }): boolean {
  if (jwk.kid !== undefined && badge.payload.kid !== jwk.kid) return false;
  const bytes = signedBytes(badge.payload);
  if (b64url(createHash("sha256").update(bytes).digest()).slice(0, 22) !== badge.id) return false;
  const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: jwk.x }, format: "jwk" });
  return verify(null, Buffer.from(bytes), key, Buffer.from(badge.signature, "base64url"));
}
