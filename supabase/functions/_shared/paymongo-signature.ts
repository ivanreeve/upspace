export type PaymongoWebhookSignature = {
  timestamp: number;
  te?: string;
  li?: string;
};

export function parsePaymongoSignatureHeader(header: string | null): PaymongoWebhookSignature | null {
  if (!header) return null;

  const normalized = header.split(',').map((part) => part.trim());
  const result: PaymongoWebhookSignature = { timestamp: 0, };

  for (const part of normalized) {
    const [key, value] = part.split('=').map((segment) => segment.trim());
    if (!key || !value) continue;
    if (key === 't') {
      result.timestamp = Number(value);
    } else if (key === 'te') {
      result.te = value;
    } else if (key === 'li') {
      result.li = value;
    }
  }

  if (!result.timestamp) {
    return null;
  }

  return result;
}

const textEncoder = new TextEncoder();

function hexToUint8Array(hex: string) {
  const normalized = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    const byte = Number.parseInt(normalized.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) {
      return new Uint8Array();
    }
    bytes[i / 2] = byte;
  }
  return bytes;
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }

  return diff === 0;
}

async function computeHmacDigest(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  return new Uint8Array(await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload)));
}

export type VerifyPaymongoSignatureOptions = {
  payload: string;
  signature: PaymongoWebhookSignature;
  secret: string;
  useLiveSignature?: boolean;
};

export async function verifyPaymongoSignatureWithSecret({
  payload,
  signature,
  secret,
  useLiveSignature,
}: VerifyPaymongoSignatureOptions) {
  const signatureValue = useLiveSignature ? signature.li : signature.te;
  if (!signatureValue) {
    return false;
  }

  const unsignedString = `${signature.timestamp}.${payload}`;
  const computed = await computeHmacDigest(secret, unsignedString);
  const incoming = hexToUint8Array(signatureValue);

  if (!incoming.length || incoming.length !== computed.length) {
    return false;
  }

  return timingSafeEqualBytes(incoming, computed);
}

export function isPaymongoSignatureFresh(signature: PaymongoWebhookSignature, toleranceSeconds = 300) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - signature.timestamp) <= toleranceSeconds;
}
