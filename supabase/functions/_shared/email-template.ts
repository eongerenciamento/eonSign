// Shell de email compartilhado — mantém header, rodapé e componentes visuais
// consistentes entre todas as edge functions que enviam email (ver
// auth-design-system.md secção 4).

export function renderEmailShell(contentHtml: string, opts: { bannerUrl: string }): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  </head>
  <body style="margin:0; padding:0; background:#ffffff; font-family:Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding: 24px 20px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">
            <tr>
              <td style="background: linear-gradient(135deg, #273d60, #001a4d); text-align:center; border-radius:12px 12px 0 0;">
                <img src="${opts.bannerUrl}" alt="eonSign" style="width:100%; height:auto; display:block; border-radius:12px 12px 0 0;" />
              </td>
            </tr>
            <tr>
              <td style="padding: 24px; background: #f4f4f5;">
                ${contentHtml}
              </td>
            </tr>
            <tr>
              <td style="background:#f4f4f5; padding:20px; text-align:center; border-radius:0 0 12px 12px;">
                <p style="color:#6b7280; margin:0 0 8px 0; font-size:12px;">eon<strong>Sign</strong></p>
                <p style="color:#6b7280; margin:0; font-size:12px;">
                  Powered by <strong>eon</strong><a href="https://eonhub.com.br" style="color:#6b7280; text-decoration:none;"><strong>hub</strong></a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderCredentialsBox(rows: { label: string; value: string }[]): string {
  const rowsHtml = rows
    .map(
      (row) =>
        `<p style="margin:8px 0; color:#333; font-size:14px;"><strong>${row.label}:</strong> ${row.value}</p>`
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:white; border-radius:8px; margin:20px 0;">
      <tr><td style="padding:16px;">
        ${rowsHtml}
      </td></tr>
    </table>`;
}

export function renderActionButton(url: string, label: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td align="center">
        <a href="${url}" style="background:#2563eb; color:white; padding:14px 36px; text-decoration:none; border-radius:9999px; font-weight:bold; font-size:14px; display:inline-block;">
          ${label}
        </a>
      </td></tr>
    </table>`;
}
