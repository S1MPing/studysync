import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const FROM = process.env.SMTP_FROM || "StudySync <no-reply@studysync.app>";

async function sendEmail(to: string, subject: string, html: string) {
  if (!transporter || !to) return;
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("[email] Failed to send:", (err as any).message);
  }
}

export async function notifySessionRequest(tutorEmail: string, tutorName: string, studentName: string, courseCode: string) {
  await sendEmail(
    tutorEmail,
    `New session request — ${courseCode}`,
    `<p>Hi <strong>${tutorName}</strong>,</p>
     <p><strong>${studentName}</strong> has sent you a tutoring session request for <strong>${courseCode}</strong>.</p>
     <p>Log in to <a href="${process.env.APP_URL || "http://localhost:5000"}">StudySync</a> to accept or decline.</p>`
  );
}

export async function notifySessionStatus(studentEmail: string, studentName: string, status: string, courseCode: string, tutorName: string) {
  const verb = status === "accepted" ? "accepted" : "declined";
  await sendEmail(
    studentEmail,
    `Your ${courseCode} session was ${verb}`,
    `<p>Hi <strong>${studentName}</strong>,</p>
     <p>Your tutoring session for <strong>${courseCode}</strong> with <strong>${tutorName}</strong> has been <strong>${verb}</strong>.</p>
     <p>Log in to <a href="${process.env.APP_URL || "http://localhost:5000"}">StudySync</a> ${status === "accepted" ? "to start chatting." : "to find another tutor."}</p>`
  );
}

export async function notifyNewMessage(recipientEmail: string, recipientName: string, senderName: string, courseCode: string) {
  await sendEmail(
    recipientEmail,
    `New message from ${senderName} — ${courseCode}`,
    `<p>Hi <strong>${recipientName}</strong>,</p>
     <p><strong>${senderName}</strong> sent you a message in your <strong>${courseCode}</strong> tutoring session.</p>
     <p>Log in to <a href="${process.env.APP_URL || "http://localhost:5000"}">StudySync</a> to reply.</p>`
  );
}
