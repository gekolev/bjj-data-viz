export function authError(error: unknown): string {
  const code = (error as { code?: string })?.code
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account already uses this email. Log in or reset your password.',
    'auth/weak-password': 'Choose a stronger password, with at least 8 characters.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
    'auth/network-request-failed': 'Could not connect. Check your internet connection and try again.',
    'auth/operation-not-allowed': 'Email/password sign-in needs to be enabled in Firebase.',
    'permission-denied': 'Cloud access was denied. Verify your email and check that the Firestore rules are published.',
    'unavailable': 'Cloud storage is unavailable. Check your connection and try again.',
  }
  return messages[code ?? ''] ?? (error instanceof Error && error.message.startsWith('Conflict:') ? error.message : 'Something went wrong. Please try again.')
}
