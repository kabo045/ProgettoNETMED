/*  Policy unica per la sicurezza delle password.
  Usata da: POST /api/auth/register, POST /api/auth/reset-password,
  PUT  /api/user/me/password.

  Regole:
   - almeno 8 caratteri
   - almeno una lettera minuscola
   - almeno una lettera MAIUSCOLA
   - almeno una cifra
   - almeno un simbolo (qualsiasi non-alphanumeric)
   - vietate le password "comuni" (lista nera minima)
*/ 

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "qwerty",
  "qwerty123",
  "12345678",
  "123456789",
  "1234567890",
  "admin",
  "admin123",
  "iloveyou",
  "welcome",
  "welcome1",
  "letmein",
  "monkey",
  "abc12345",
  "111111",
  "000000",
  "ciao12345",
  "test1234",
  "netmed",
  "netmed123",
]);

function validatePassword(pwd) {
  pwd = String(pwd || "");

  if (pwd.length < 8)
    return { ok: false, error: "La password deve essere lunga almeno 8 caratteri" };
  if (pwd.length > 72)
    return { ok: false, error: "La password e' troppo lunga (max 72 caratteri)" };

  if (!/[a-z]/.test(pwd))
    return { ok: false, error: "La password deve contenere almeno una lettera minuscola" };
  if (!/[A-Z]/.test(pwd))
    return { ok: false, error: "La password deve contenere almeno una lettera maiuscola" };
  if (!/[0-9]/.test(pwd))
    return { ok: false, error: "La password deve contenere almeno una cifra" };
  if (!/[^A-Za-z0-9]/.test(pwd))
    return { ok: false, error: "La password deve contenere almeno un simbolo (es. !@#$%)" };

  if (COMMON_PASSWORDS.has(pwd.toLowerCase())) {
    return { ok: false, error: "Questa password e' troppo comune, scegline un'altra" };
  }

  // sequenze ovvie tipo "12345678" o "abcdefgh"
  if (/^(?:0123456789|1234567890|abcdefgh|qwertyui|asdfghjk)/i.test(pwd)) {
    return { ok: false, error: "Evita sequenze ovvie nella password" };
  }

  return { ok: true };
}

// Score 0..4 — usato dalla UI per mostrare la barra di robustezza.
// 0 = vuota / debolissima, 4 = molto forte.
function passwordScore(pwd) {
  pwd = String(pwd || "");
  if (!pwd) return 0;
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  let classes = 0;
  if (/[a-z]/.test(pwd)) classes++;
  if (/[A-Z]/.test(pwd)) classes++;
  if (/[0-9]/.test(pwd)) classes++;
  if (/[^A-Za-z0-9]/.test(pwd)) classes++;
  if (classes >= 3) s++;
  if (classes === 4 && pwd.length >= 10) s++;
  if (COMMON_PASSWORDS.has(pwd.toLowerCase())) s = Math.min(s, 1);
  return Math.min(s, 4);
}

module.exports = { validatePassword, passwordScore };
