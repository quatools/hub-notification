/**
 * Layout HTML pour les emails de notification.
 * Style inline pour compatibilité maximale avec les clients email.
 */

export function wrapEmailLayout(content: string, eventLabel: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${eventLabel}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#18181b;padding:20px 24px;">
              <span style="color:#ffffff;font-size:16px;font-weight:600;">Quatools Notifications</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:24px;color:#27272a;font-size:14px;line-height:1.6;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e4e4e7;text-align:center;">
              <a href="https://notifications.quatools.fr/preferences" style="color:#71717a;font-size:12px;text-decoration:underline;">Gérer mes notifications</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
