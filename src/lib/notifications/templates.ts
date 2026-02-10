/**
 * Moteur de rendu de templates.
 * Remplace les {{variable}} par les valeurs du payload.
 */

/**
 * Rend un template en remplaçant les variables {{key}} par les valeurs du payload.
 * Les variables manquantes sont remplacées par une chaîne vide.
 */
export function renderTemplate(
  template: string,
  payload: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = payload[key]
    if (value === undefined || value === null) {
      return ''
    }
    return String(value)
  })
}
