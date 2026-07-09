import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/notification-delivery";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Le nom doit comporter au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional().or(z.literal("")),
  subject: z.string().min(2, "Le sujet est requis"),
  message: z.string().min(10, "Le message doit comporter au moins 10 caractères"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  const { name, email, phone, subject, message } = parsed.data;

  try {
    const contactMessage = await db.contactMessage.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        subject,
        message,
      },
    });

    const supportEmail = await getSupportEmail();
    const delivery = supportEmail
      ? await sendEmail({
          to: supportEmail,
          subject: `Nouveau message contact - ${subject}`,
          text: [
            "Nouveau message reçu depuis la page contact Compétence.",
            "",
            `Nom : ${name}`,
            `Email : ${email.toLowerCase().trim()}`,
            phone?.trim() ? `Téléphone : ${phone.trim()}` : "Téléphone : non renseigné",
            `Sujet : ${subject}`,
            "",
            "Message :",
            message,
            "",
            "Ce message est également enregistré dans Admin > Messages.",
          ].join("\n"),
        })
      : {
          ok: false,
          configured: false,
          message: "Email service client non configuré.",
        };

    await db.notification.create({
      data: {
        title: "Nouveau message contact",
        message: `${name} a envoyé un message: ${subject}. ${delivery.ok ? "Email service client envoyé." : delivery.message}`,
        type: "CONTACT_MESSAGE",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "CREATED",
        priority: "IMPORTANT",
        sentAt: new Date(),
        link: "/admin/messages",
        actionLabel: "Voir messages",
        response: `contactMessageId=${contactMessage.id}`,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/contact] error:", e);
    return NextResponse.json(
      { error: "Impossible d'enregistrer votre message. Réessayez." },
      { status: 500 }
    );
  }
}

async function getSupportEmail() {
  const setting = await db.setting.findUnique({ where: { key: "support_email" } });
  return setting?.value?.trim() || process.env.SUPPORT_EMAIL || "contact@competence.ci";
}
