import Aquafier from 'aqua-js-sdk/web';

type WalletLike = {
  address: string;
  sign: (message: string) => Promise<string>;
};

export type AttestationProof = {
  hash: string;
  digest: string;
  signer?: string | null;
  signature?: string | null;
};

const aquafier = new Aquafier();
const textEncoder = new TextEncoder();

type AquaGenesisResult = {
  tag: 'ok' | 'error';
  data?: {
    aquaTree?: {
      tree?: { hash?: string | null } | null;
      treeMapping?: { latestHash?: string | null } | null;
    };
  };
  logData?: unknown[];
};

function toHex(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function signPayloadDigest(
  wallet: WalletLike | undefined,
  kind: string,
  digest: string,
) {
  if (!wallet) {
    return { signature: null, signer: null };
  }

  const message = [
    'ETH Safari Ops Hub Attestation',
    `Kind: ${kind}`,
    `Digest: ${digest}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join('\n');

  const signature = await wallet.sign(message);
  return {
    signature,
    signer: wallet.address,
  };
}

export async function createBrowserAttestation(
  kind: string,
  payload: Record<string, unknown>,
  wallet?: WalletLike,
): Promise<AttestationProof> {
  const canonicalPayload = JSON.stringify(payload);
  const digestBuffer = await crypto.subtle.digest('SHA-256', textEncoder.encode(canonicalPayload));
  const digest = toHex(digestBuffer);

  const { signature, signer } = await signPayloadDigest(wallet, kind, digest);

  const document = {
    kind,
    payload,
    digest,
    signature,
    signer,
    timestamp: new Date().toISOString(),
  };

  const fileObject = {
    fileName: `${kind}-${crypto.randomUUID()}.json`,
    fileContent: JSON.stringify(document),
    path: `/attestations/${kind}`,
  };

  const result = (await aquafier.createGenesisRevision(fileObject)) as AquaGenesisResult;

  if (result?.tag !== 'ok') {
    throw new Error('Failed to create Aqua attestation');
  }

  const hash =
    result.data?.aquaTree?.tree?.hash ??
    result.data?.aquaTree?.treeMapping?.latestHash ??
    null;

  if (!hash) {
    throw new Error('Aqua attestation did not return a hash');
  }

  return {
    hash,
    digest,
    signature,
    signer,
  };
}
