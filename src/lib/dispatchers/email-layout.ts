/**
 * Layout HTML pour les emails de notification.
 * Contraintes clients mail : tables + styles inline pour le critique,
 * <style> en tête pour le confort (supporté par Gmail/Apple Mail/Outlook.com).
 * Marque blanche : le header porte le nom de l'organisation, Quatools reste
 * discret dans le footer.
 */

/** Couleur d'accent par catégorie d'événement (miroir des embeds Discord). */
const CATEGORY_ACCENTS: Record<string, string> = {
  billing: '#3498db',
  member: '#2ecc71',
  team: '#e67e22',
  shop: '#9b59b6',
  system: '#95a5a6',
}

interface EmailLayoutOptions {
  /** Nom d'expéditeur marque blanche ("Club Démo") */
  senderName?: string | null
  /** Catégorie de l'événement, pilote la couleur d'accent */
  category?: string
}

export function wrapEmailLayout(
  content: string,
  eventLabel: string,
  options: EmailLayoutOptions = {}
): string {
  const brandName = options.senderName || 'Quatools Notifications'
  const accent = CATEGORY_ACCENTS[options.category || ''] || '#52525b'

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${eventLabel}</title>
  <style>
    .content h1 { font-size: 22px; font-weight: 700; color: #1c1b1a; margin: 0 0 12px; }
    .content h2 { font-size: 18px; font-weight: 700; color: #1c1b1a; margin: 0 0 12px; }
    .content p { margin: 0 0 12px; }
    .content p:last-child { margin-bottom: 0; }
    .content strong { color: #1c1b1a; }
    .content a { color: ${accent}; }
    .content ul { margin: 0 0 12px; padding-left: 20px; }
    @media (max-width: 480px) {
      .card-pad { padding: 24px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f1f0ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Préheader invisible (texte d'aperçu dans la boîte de réception) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${eventLabel} — ${brandName}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f0ee;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

          <!-- Header : nom de l'organisation (marque blanche) -->
          <tr>
            <td style="padding:0 8px 16px;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;letter-spacing:0.2px;color:#1c1b1a;">${brandName}</span>
            </td>
          </tr>

          <!-- Carte principale -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;border:1px solid #e7e5e1;border-top:4px solid ${accent};">
                <tr>
                  <td class="card-pad" style="padding:32px 36px;">
                    <!-- Eyebrow : type de notification -->
                    <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${accent};">${eventLabel}</p>
                    <!-- Contenu rédigé par l'admin -->
                    <div class="content" style="font-size:15px;line-height:1.65;color:#44423e;">
                      ${content}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 8px 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#8a8782;">
                Envoyé par <strong style="color:#5f5c57;">${brandName}</strong>
              </p>
              <p style="margin:0;font-size:11px;color:#a8a49e;">
                <a href="https://notifications.quatools.fr/preferences" style="color:#8a8782;text-decoration:underline;">Gérer mes notifications</a>
                &nbsp;·&nbsp; propulsé par Quatools
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
