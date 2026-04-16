import { SignJWT, jwtVerify } from "jose";

const SESSION_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-this-in-production"
);

const AGENT_SECRET_PREFIX = "agent-"; // per-device secrets are stored in DB

export interface SessionPayload {
  sub: string;   // userId
  email: string;
  role: string;
  displayName: string;
}

export interface AgentPayload {
  sub: string;   // authUid
  deviceId: string;
  role: "agent";
}

// ── Session JWTs (admin/user login) ────────────────────────────────────────

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(SESSION_SECRET);
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ── Agent JWTs (per-device, secret stored in MongoDB) ──────────────────────

export function makeAgentSecret(jwtSecret: string): Uint8Array {
  return new TextEncoder().encode(AGENT_SECRET_PREFIX + jwtSecret);
}

export async function signAgentToken(
  payload: AgentPayload,
  jwtSecret: string
): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(makeAgentSecret(jwtSecret));
}

export async function verifyAgentToken(
  token: string,
  jwtSecret: string
): Promise<AgentPayload | null> {
  try {
    const { payload } = await jwtVerify(token, makeAgentSecret(jwtSecret));
    return payload as unknown as AgentPayload;
  } catch {
    return null;
  }
}
