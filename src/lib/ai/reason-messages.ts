/** Warm, user-facing message for an AI failure reason. Client-safe (no secrets). */
export function aiReasonMessage(reason?: string): string {
  switch (reason) {
    case "sin-key":
      return "Activa el mediador en Ajustes para usar la IA ✨";
    case "saturado":
      return "El modelo está saturado ahora mismo (suele pasar con los modelos gratuitos). Prueben de nuevo en un momento, o elijan otro modelo en Ajustes.";
    case "credito":
      return "Tu cuenta de OpenRouter necesita más créditos para este modelo. Agrégalos, o elige un modelo más económico en Ajustes.";
    case "auth":
      return "Hay un problema con la API key de OpenRouter. Revísala en Ajustes.";
    default:
      return "La IA no pudo responder ahora, intenten de nuevo.";
  }
}
