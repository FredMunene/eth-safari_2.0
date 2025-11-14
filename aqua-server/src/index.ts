import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { z } from 'zod';
import Aquafier from 'aqua-js-sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PORT = Number(process.env.PORT ?? 8787);
const sharedToken = process.env.AQUA_SERVICE_TOKEN;
const aquaEnabled = process.env.AQUA_ENABLED !== 'false';

if (!sharedToken) {
  throw new Error('AQUA_SERVICE_TOKEN must be set for the attestation service');
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase: SupabaseClient | null =
  supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

const aquafier = aquaEnabled ? new Aquafier() : null;

const requestSchema = z.object({
  kind: z.string().min(1),
  payload: z.record(z.any()),
  supabaseUpdate: z
    .object({
      table: z.string().min(1),
      id_column: z.string().min(1).default('id'),
      id_value: z.any(),
      hash_column: z.string().min(1).default('aqua_attestation_hash'),
    })
    .optional(),
});

const app = express();
app.use(
  cors({
    origin: '*',
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    aquaEnabled,
    supabaseConnected: Boolean(supabase),
  });
});

app.post('/attest', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing bearer token' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (token !== sharedToken) {
    return res.status(401).json({ error: 'invalid token' });
  }

  const parseResult = requestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'invalid payload', details: parseResult.error.flatten() });
  }

  if (!aquafier || !aquaEnabled) {
    return res.status(503).json({ error: 'aqua sdk disabled' });
  }

  const { kind, payload, supabaseUpdate } = parseResult.data;

  try {
    const fileObject = {
      fileName: `${kind}-${crypto.randomUUID()}.json`,
      fileContent: JSON.stringify({
        ...payload,
        kind,
        timestamp: new Date().toISOString(),
      }),
    };
    const result = await aquafier.createGenesisRevision(fileObject);
    const hash =
      result?.data?.aquaTree?.tree?.hash ??
      result?.data?.aquaTree?.treeMapping?.latestHash ??
      null;

    if (!hash) {
      console.error('Aqua SDK responded without hash', result);
      return res.status(502).json({ error: 'aqua_sdk_failed' });
    }

    if (supabase && supabaseUpdate) {
      const { table, id_column, id_value, hash_column } = supabaseUpdate;
      const { error } = await supabase
        .from(table)
        .update({ [hash_column]: hash })
        .eq(id_column, id_value);
      if (error) {
        console.error('Failed to update Supabase row', error);
        return res.status(500).json({ error: 'supabase_update_failed', hash });
      }
    }

    return res.json({ hash });
  } catch (error) {
    console.error('Attestation failed', error);
    return res.status(500).json({ error: 'attestation_failed' });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.listen(PORT, () => {
  console.log(`Aqua attestation service listening on http://localhost:${PORT}`);
});
