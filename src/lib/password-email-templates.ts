type PasswordResetTemplateInput = {
  name: string;
  resetUrl: string;
  expiresInMinutes?: number;
};

type PasswordChangedTemplateInput = {
  name: string;
  changedAtLabel: string;
  securityUrl: string;
  accountLabel?: string;
};

export function passwordResetEmailTemplate(input: PasswordResetTemplateInput) {
  const name = input.name.trim() || "utilisateur";
  const expiresInMinutes = input.expiresInMinutes ?? 60;
  const safeName = escapeHtml(name);
  const safeResetUrl = escapeHtml(input.resetUrl);

  return {
    text: [
      `Bonjour ${name},`,
      "",
      "Une demande de réinitialisation du mot de passe de votre compte Compétence a été reçue.",
      "Utilisez ce lien sécurisé pour choisir un nouveau mot de passe :",
      input.resetUrl,
      "",
      `Ce lien est personnel, utilisable une seule fois et expire dans ${expiresInMinutes} minutes.`,
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.",
      "",
      "Compétence",
    ].join("\n"),
    html: emailShell({
      preview: "Votre lien sécurisé de réinitialisation Compétence",
      content: `
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#111827">Bonjour ${safeName},</p>
        <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#111827">Choisissez un nouveau mot de passe</h1>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#475569">Une demande de réinitialisation a été reçue pour votre compte Compétence. Cliquez sur le bouton ci-dessous pour continuer.</p>
        <p style="margin:0 0 24px"><a href="${safeResetUrl}" style="display:inline-block;border-radius:8px;background:#111b4d;color:#ffffff;text-decoration:none;padding:13px 20px;font-size:15px;font-weight:700">Modifier mon mot de passe</a></p>
        <div style="border:1px solid #dbe3f0;border-radius:8px;background:#f8fafc;padding:15px 16px">
          <p style="margin:0;font-size:13px;line-height:1.65;color:#475569"><strong style="color:#111827">Lien personnel et temporaire.</strong> Il est utilisable une seule fois et expire dans ${expiresInMinutes} minutes.</p>
        </div>
        <p style="margin:20px 0 6px;font-size:13px;line-height:1.6;color:#64748b">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
        <p style="margin:0;word-break:break-all;font-size:12px;line-height:1.6;color:#111b4d">${safeResetUrl}</p>
        <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b">Vous n'avez rien demandé ? Ignorez cet email. Votre mot de passe reste inchangé.</p>`,
    }),
  };
}

export function passwordChangedEmailTemplate(input: PasswordChangedTemplateInput) {
  const name = input.name.trim() || "utilisateur";
  const accountLabel = input.accountLabel?.trim() || "compte Compétence";
  const safeName = escapeHtml(name);
  const safeSecurityUrl = escapeHtml(input.securityUrl);

  return {
    text: [
      `Bonjour ${name},`,
      "",
      `Le mot de passe de votre ${accountLabel} vient d'être modifié avec succès.`,
      `Date et heure : ${input.changedAtLabel} (heure de Côte d'Ivoire).`,
      "",
      "Si vous êtes à l'origine de cette action, aucune intervention n'est nécessaire.",
      "Si vous ne reconnaissez pas cette modification, sécurisez immédiatement votre compte :",
      input.securityUrl,
      "",
      "Le service client Compétence ne vous demandera jamais votre mot de passe par email, SMS ou WhatsApp.",
      "",
      "Compétence",
    ].join("\n"),
    html: emailShell({
      preview: "Confirmation de modification de votre mot de passe Compétence",
      content: `
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#111827">Bonjour ${safeName},</p>
        <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#111827">Votre mot de passe a été modifié</h1>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#475569">La modification de votre ${escapeHtml(accountLabel)} a été enregistrée le <strong style="color:#111827">${escapeHtml(input.changedAtLabel)}</strong>, heure de Côte d'Ivoire.</p>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#475569">Si vous êtes à l'origine de cette action, aucune intervention n'est nécessaire.</p>
        <div style="border:1px solid #fecaca;border-radius:8px;background:#fffafa;padding:16px">
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#991b1b"><strong>Vous ne reconnaissez pas cette action ?</strong><br>Sécurisez immédiatement votre compte et contactez Compétence si nécessaire.</p>
          <a href="${safeSecurityUrl}" style="display:inline-block;border-radius:8px;background:#111b4d;color:#ffffff;text-decoration:none;padding:12px 17px;font-size:14px;font-weight:700">Sécuriser mon compte</a>
        </div>
        <p style="margin:20px 0 0;font-size:12px;line-height:1.65;color:#64748b">Compétence ne vous demandera jamais votre mot de passe par email, SMS ou WhatsApp.</p>`,
    }),
  };
}

function emailShell(input: { preview: string; content: string }) {
  return `<!doctype html>
    <html lang="fr">
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preview)}</div>
        <div style="max-width:620px;margin:0 auto;padding:28px 14px">
          <div style="overflow:hidden;border:1px solid #dbe3f0;border-radius:12px;background:#ffffff">
            <div style="border-bottom:4px solid #f4c430;background:#111b4d;padding:22px 24px;color:#ffffff">
              <div style="font-size:21px;font-weight:800;letter-spacing:.2px">Compétence</div>
              <div style="margin-top:4px;font-size:12px;color:#dbe5ff">Cours, accompagnement et formation</div>
            </div>
            <div style="padding:26px 24px">${input.content}</div>
            <div style="border-top:1px solid #e7ecf3;background:#f8fafc;padding:15px 24px;font-size:11px;line-height:1.6;color:#64748b">
              Message automatique de sécurité envoyé par Compétence. Ne transmettez jamais vos liens ou mots de passe.
            </div>
          </div>
        </div>
      </body>
    </html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}
