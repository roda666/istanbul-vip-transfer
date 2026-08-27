import 'server-only';

import { Storage } from '@google-cloud/storage';

type RecoveryFallbackInput = {
  submissionId: string;
  referenceNumber: string;
  requestPayload: Record<string, unknown>;
  lastError: string;
  attempts: number;
};

export type RecoveryFallbackItem = {
  id: string;
  submissionId: string;
  referenceNumber: string;
  lastError: string;
  updatedAt: Date;
};

function parsePrivateObjectDir(): { bucketName: string; prefix: string } {
  const raw = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!raw) throw new Error('PRIVATE_OBJECT_DIR is not configured');
  const cleaned = raw.replace(/^gs:\/\//, '').replace(/^\/+/, '');
  const slash = cleaned.indexOf('/');
  if (slash === -1) return { bucketName: cleaned, prefix: '' };
  return { bucketName: cleaned.slice(0, slash), prefix: cleaned.slice(slash + 1) };
}

function recoveryPrefix(prefix: string): string {
  return [prefix.replace(/^\/+|\/+$/g, ''), 'reservation-recovery']
    .filter(Boolean)
    .join('/');
}

function createStorageClient(): Storage {
  const sidecar = process.env.REPLIT_SIDECAR_ENDPOINT ?? 'http://127.0.0.1:1106';
  return new Storage({
    credentials: {
      audience: 'replit',
      subject_token_type: 'access_token',
      token_url: `${sidecar}/token`,
      type: 'external_account',
      credential_source: {
        url: `${sidecar}/credential`,
        format: {
          type: 'json',
          subject_token_field_name: 'access_token',
        },
      },
      universe_domain: 'googleapis.com',
    },
    projectId: '',
  });
}

async function getRecoveryFile(submissionId: string) {
  const { bucketName, prefix } = parsePrivateObjectDir();
  const objectName = `${recoveryPrefix(prefix)}/${submissionId}.json`;
  return createStorageClient().bucket(bucketName).file(objectName);
}

export async function persistReservationRecoveryFallback(
  input: RecoveryFallbackInput,
): Promise<{ persisted: boolean; created: boolean }> {
  try {
    const file = await getRecoveryFile(input.submissionId);
    await file.save(JSON.stringify({
      version: 1,
      ...input,
      createdAt: new Date().toISOString(),
    }), {
      resumable: false,
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-store',
        metadata: {
          referenceNumber: input.referenceNumber,
          lastError: input.lastError,
          updatedAt: new Date().toISOString(),
        },
      },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
    return { persisted: true, created: true };
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (code === 412 || code === '412') return { persisted: true, created: false };
    return { persisted: false, created: false };
  }
}

export async function resolveReservationRecoveryFallback(submissionId: string): Promise<void> {
  try {
    const file = await getRecoveryFile(submissionId);
    await file.delete({ ignoreNotFound: true });
  } catch {
    // A stale private fallback remains visible in the dashboard and can be
    // reconciled later; it must never make a successful reservation fail.
  }
}

export async function listReservationRecoveryFallbacks(): Promise<RecoveryFallbackItem[]> {
  const { bucketName, prefix } = parsePrivateObjectDir();
  const objectPrefix = `${recoveryPrefix(prefix)}/`;
  const [files] = await createStorageClient().bucket(bucketName).getFiles({ prefix: objectPrefix });
  const items = await Promise.all(files.map(async (file): Promise<RecoveryFallbackItem | null> => {
    try {
      const [metadata] = await file.getMetadata();
      const submissionId = file.name.slice(objectPrefix.length).replace(/\.json$/, '');
      const referenceNumber = metadata.metadata?.referenceNumber;
      const lastError = metadata.metadata?.lastError;
      const updatedAt = metadata.metadata?.updatedAt ?? metadata.updated;
      if (
        !submissionId
        || typeof referenceNumber !== 'string'
        || typeof lastError !== 'string'
        || (typeof updatedAt !== 'string' && typeof updatedAt !== 'number')
      ) return null;
      return {
        id: `storage-${submissionId}`,
        submissionId,
        referenceNumber,
        lastError,
        updatedAt: new Date(updatedAt),
      };
    } catch {
      return null;
    }
  }));
  return items
    .filter((item): item is RecoveryFallbackItem => item !== null)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}