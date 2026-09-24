import type { Connector } from "./types";
import { cdcNwss } from "./cdc-nwss";
import { canada } from "./canada";
import { esrNz } from "./esr-nz";

export const CONNECTORS: Connector[] = [cdcNwss, canada, esrNz];

export const CONNECTOR_BY_ID: Record<string, Connector> = Object.fromEntries(
  CONNECTORS.map((c) => [c.id, c]),
);
