// Tipurile stărilor de formular întoarse de Server Actions. Validarea
// propriu-zisă (Pydantic) rulează acum pe backend-ul FastAPI — aici păstrăm
// doar un mesaj generic de eroare, ca UI-ul să aibă ce afișa.

export type LoginFormState = { message?: string } | undefined;

export type RegisterFormState = { message?: string; success?: boolean; phone?: string } | undefined;

export type ChangePasswordFormState = { message?: string; success?: boolean } | undefined;
