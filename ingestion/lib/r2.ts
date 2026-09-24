// Optional sink: push the Parquet lake to Cloudflare R2 (10 GB free, $0 egress).
// No-op unless all R2_* env vars are present, so local runs work without credentials.
// Site-level/historical drill-downs (DuckDB-WASM) read these files via HTTP range.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const ROOT = process.cwd();
const LAKE_DIR = path.join(ROOT, "data", "lake");

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  prefix: string;
}

function readConfig(): R2Config | null {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_PREFIX,
  } = process.env;
  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET
  ) {
    return null;
  }
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    prefix: R2_PREFIX ?? "lake",
  };
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : Promise.resolve([full]);
    }),
  );
  return files.flat();
}

/** Upload every Parquet file under data/lake to R2, preserving the hive layout. */
export async function syncLakeToR2(): Promise<void> {
  const cfg = readConfig();
  if (!cfg) {
    console.log("R2 not configured (R2_* env vars absent) — skipping lake upload.");
    return;
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });

  const files = await walk(LAKE_DIR);
  let n = 0;
  for (const file of files) {
    if (!file.endsWith(".parquet")) continue;
    const key = `${cfg.prefix}/${path.relative(LAKE_DIR, file).split(path.sep).join("/")}`;
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: await readFile(file),
        ContentType: "application/vnd.apache.parquet",
      }),
    );
    n++;
  }
  console.log(`R2: uploaded ${n} parquet files to ${cfg.bucket}/${cfg.prefix}/`);
}
