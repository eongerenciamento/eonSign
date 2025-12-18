import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(6, "A senha deve ter pelo menos 6 caracteres");

export const passwordRequirementHint = "Mínimo de 6 caracteres";
