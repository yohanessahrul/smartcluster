type ResetTokenMap = Map<string, string>;

const globalForResetToken = globalThis as typeof globalThis & {
  smartPerumahanResetTokenMap?: ResetTokenMap;
};

const resetTokenMap = globalForResetToken.smartPerumahanResetTokenMap ?? new Map<string, string>();

if (!globalForResetToken.smartPerumahanResetTokenMap) {
  globalForResetToken.smartPerumahanResetTokenMap = resetTokenMap;
}

export function setResetTokenByEmail(email: string, token: string) {
  resetTokenMap.set(email.toLowerCase(), token);
}

export function getResetTokenByEmail(email: string) {
  return resetTokenMap.get(email.toLowerCase()) ?? null;
}

export function clearResetTokenByEmail(email: string) {
  resetTokenMap.delete(email.toLowerCase());
}
