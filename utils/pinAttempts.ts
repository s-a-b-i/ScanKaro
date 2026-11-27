/**
 * Wrong-PIN limits that survive closing the app. Kept in memory before, so killing and
 * reopening the app reset them and a 4-digit PIN could be guessed without waiting.
 * Each round of MAX_ATTEMPTS wrong PINs doubles the wait: 30 s, 1 min, 2 min… up to 1 h.
 */
import * as SecureStore from 'expo-secure-store';

const MAX_ATTEMPTS = 5;
const BASE_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 60 * 60_000;

type State = { failed: number; rounds: number; lockedUntil: number };

const keyFor = (scope: string) => `scankaro.pinAttempts.${scope}`;

async function read(scope: string): Promise<State> {
  try {
    const raw = await SecureStore.getItemAsync(keyFor(scope));
    if (raw) {
      const s = JSON.parse(raw) as Partial<State>;
      return { failed: s.failed ?? 0, rounds: s.rounds ?? 0, lockedUntil: s.lockedUntil ?? 0 };
    }
  } catch {
    // unreadable: start clean rather than lock the owner out
  }
  return { failed: 0, rounds: 0, lockedUntil: 0 };
}

async function write(scope: string, state: State) {
  try {
    await SecureStore.setItemAsync(keyFor(scope), JSON.stringify(state));
  } catch {
    // best effort
  }
}

export type AttemptResult = { waitSeconds?: number; attemptsLeft?: number };

/** Seconds still to wait before another try, or 0. */
export async function pinWaitSeconds(scope: string, now = Date.now()): Promise<number> {
  const { lockedUntil } = await read(scope);
  return lockedUntil > now ? Math.ceil((lockedUntil - now) / 1000) : 0;
}

export async function recordPinFailure(scope: string, now = Date.now()): Promise<AttemptResult> {
  const s = await read(scope);
  const failed = s.failed + 1;
  if (failed >= MAX_ATTEMPTS) {
    const rounds = s.rounds + 1;
    const cooldown = Math.min(BASE_COOLDOWN_MS * 2 ** (rounds - 1), MAX_COOLDOWN_MS);
    await write(scope, { failed: 0, rounds, lockedUntil: now + cooldown });
    return { waitSeconds: Math.ceil(cooldown / 1000) };
  }
  await write(scope, { ...s, failed });
  return { attemptsLeft: MAX_ATTEMPTS - failed };
}

export async function recordPinSuccess(scope: string) {
  try {
    await SecureStore.deleteItemAsync(keyFor(scope));
  } catch {
    // ignore
  }
}
