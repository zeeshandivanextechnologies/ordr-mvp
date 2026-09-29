import nodemailer from "nodemailer";

let transporter = null;

// One font for every email: Poppins (the app's font) in mail apps that load web fonts,
// otherwise the closest common system fonts
const EMAIL_FONT = "Poppins,'Segoe UI',Tahoma,Arial,sans-serif";
const EMAIL_HEAD = '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
  + '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet"></head>';

async function getTransporter() {
  if (transporter) return transporter;

  // Tests (tests/setup.js): messages are built but never sent
  if (process.env.EMAIL_DISABLED === 'true') {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    console.log("--- Ethereal Test Email ---");
    console.log("Email:", testAccount.user);
    console.log("Password:", testAccount.pass);
    console.log("View emails at: https://ethereal.email/login");
    console.log("---------------------------");
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  return transporter;
}

function otpTemplate(otp) {
  return `<!DOCTYPE html>
  <html>
  ${EMAIL_HEAD}
  <body style="font-family:${EMAIL_FONT};background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);font-family:${EMAIL_FONT};">
  <div style="background:linear-gradient(135deg,#201d6a,#3d35a0);padding:15px 30px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:22
  px;letter-spacing:2px;">ORDR</h1></div>
  <div style="padding:15px 30px;text-align:center;"><h2 style="color:#000; font-size : 30px; margin : 5px 0">Password Reset OTP</h2><p style="color:#666; font-size: 16px; margin : 0px">Use the following OTP to reset your password:</p><div style="background:#f8f9fa;border:2px dashed #201d6a;border-radius:12px;padding:20px;margin:20px 0;"><span style="font-size:36px;font-weight:700;color:#201d6a;letter-spacing:8px;">${otp}</span></div>
  <p style="color:#666;font-size:16px; margin : 5px 0px">This OTP is valid for <strong>10 minutes</strong>.</p>
  <p style="color:#666;font-size:16px; margin : 0px">If you did not request this, please ignore this email.</p>
  </div>
  <div style="padding:15px 30px;background:#f8f9fa;text-align:center;font-size:12px;color:#999;"><p>&copy; ${new Date().getFullYear()} ORDR. All rights reserved.</p>
  </div>
  </div>
  </body>
  </html>`;
}

export const sendOtpEmail = async (to, otp) => {
  try {
    const transport = await getTransporter();
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || "ORDR <noreply@ordr.app>",
      to,
      subject: "ORDR - Password Reset OTP",
      html: otpTemplate(otp),
    });

    if (!process.env.SMTP_USER) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log("Preview URL:", previewUrl);
    }

    console.log("OTP email sent to", to);
    return true;
  } catch (error) {
    console.error("Email send error:", error.message);
    return false;
  }
};

// Escapes user-provided text (names) before it is placed inside email HTML
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function teamInviteTemplate(rawInviterName, rawCompanyName, rawRole, rawInviteLink) {
  const inviterName = escapeHtml(rawInviterName);
  const companyName = escapeHtml(rawCompanyName);
  const role = escapeHtml(rawRole);
  const inviteLink = escapeHtml(rawInviteLink);
  return `<!DOCTYPE html>
  <html>
  ${EMAIL_HEAD}
  <body style="font-family:${EMAIL_FONT};background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);font-family:${EMAIL_FONT};">
  <div style="background:linear-gradient(135deg,#201d6a,#3d35a0);padding:10px 30px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:2px;">ORDR</h1></div>
  <div style="padding:15px 30px;text-align:center;">
    <h2 style="color:#000; font-size : 24px; margin : 0px; line-height: 1;">You've been invited!</h2>
    <p style="color:#000; font-size: 16px; font-weight : 500; padding : 12px 0;><b>${inviterName}</b> has invited you to join <b>${companyName}</b> as a ${role === 'admin' ? 'an' : 'a'} <b>${role}</b>.</p>
    <div style="margin: 8px 0;"> 
      <a href="${inviteLink}" style="background:#201d6a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:16px;font-weight:600;display:inline-block;">Accept Invitation</a>
    </div>
    <p style=" margin : 0px; padding : 0px; font-size:16px; font-weight : 500;">If you did not expect this, please ignore this email.</p>
  </div>
  <div style="padding:10px 30px;background:#f8f9fa;text-align:center;font-size:12px;color:#999;"><p style="margin : 0px; font-size : 16px; color : #000; font-weight : 600;">&copy; ${new Date().getFullYear()} ORDR. All rights reserved.</p></div>
  </div>
  </body>
  </html>`;
}

export const sendTeamInviteEmail = async (to, inviterName, companyName, role, inviteLink) => {
  try {
    const transport = await getTransporter();
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || "ORDR <noreply@ordr.app>",
      to,
      subject: `You've been invited to join ${companyName} on ORDR`,
      html: teamInviteTemplate(inviterName, companyName, role, inviteLink),
    });

    if (!process.env.SMTP_USER) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log("Team Invite Preview URL:", previewUrl);
    }

    console.log("Team invite email sent to", to);
    return true;
  } catch (error) {
    console.error("Invite email send error:", error.message);
    return false;
  }
};

// Billing: sent once when a payment activates or renews a plan (invoice attached)
function paymentConfirmationTemplate({ recipientName, companyName, planName, amountText, invoiceNumber, validUntil, isSubscription, billingLink }) {
  const row = (label, value) => value
    ? `<tr><td style="padding:8px 0;color:#626884;font-size:15px;text-align:left;">${label}</td><td style="padding:8px 0;color:#000;font-size:15px;font-weight:600;text-align:right;">${escapeHtml(value)}</td></tr>`
    : '';
  const safeLink = escapeHtml(billingLink);
  return `<!DOCTYPE html>
  <html>
  ${EMAIL_HEAD}
  <body style="font-family:${EMAIL_FONT};background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);font-family:${EMAIL_FONT};">
  <div style="background:linear-gradient(135deg,#201d6a,#3d35a0);padding:10px 30px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:2px;">ORDR</h1></div>
  <div style="padding:16px 24px;text-align:center;">
    <h2 style="color:#000;font-size:22px;margin:0px;font-weight:600;line-height:1.3;padding-bottom:8px;">Payment successful</h2>
    <p style="color:#000;font-size:16px;margin:0px;padding-bottom:16px;font-weight:500;line-height:1.4;">Hi ${escapeHtml(recipientName || 'there')}, your ORDR <b>${escapeHtml(planName)}</b> plan${companyName ? ` for <b>${escapeHtml(companyName)}</b>` : ''} is active.</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #d9d8e6;border-bottom:1px solid #d9d8e6;margin-bottom:16px;">
      ${row('Plan', planName)}
      ${row('Amount paid', amountText)}
      ${row('Invoice No.', invoiceNumber)}
      ${row('Valid until', validUntil)}
      ${row('Billing', isSubscription ? 'Renews automatically every month' : 'One-time payment for 1 month')}
    </table>
    <p style="color:#626884;font-size:14px;margin:0px;padding-bottom:16px;line-height:1.4;">Your invoice is attached. You can also download it any time from Billing.</p>
    ${billingLink ? `<a href="${safeLink}" style="background:#201d6a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">Open Billing</a>` : ''}
  </div>
  <div style="padding:12px 30px;background:#f8f9fa;text-align:center;font-size:14px;color:#000;font-weight:500">&copy; ${new Date().getFullYear()} ORDR. All rights reserved.</div>
  </div>
  </body>
  </html>`;
}

export const sendPaymentConfirmationEmail = async (to, details, attachment) => {
  try {
    const transport = await getTransporter();
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || "ORDR <noreply@ordr.app>",
      to,
      subject: `ORDR: Payment received - ${details.planName} plan${details.invoiceNumber ? ` (${details.invoiceNumber})` : ''}`,
      html: paymentConfirmationTemplate(details),
      attachments: attachment ? [attachment] : [],
    });
    if (!process.env.SMTP_USER) {
      console.log("Payment email preview:", nodemailer.getTestMessageUrl(info));
    }
    return true;
  } catch (error) {
    console.error("Payment email send error:", error.message);
    return false;
  }
};

// Module 24 optional email copy of an in-app notification
function notificationTemplate(title, message, link) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeLink = escapeHtml(link);
  return `<!DOCTYPE html>
  <html>
  ${EMAIL_HEAD}
  <body style="font-family:${EMAIL_FONT};background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);font-family:${EMAIL_FONT};">
  <div style="background:linear-gradient(135deg,#201d6a,#3d35a0);padding:10px 30px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:2px;">ORDR</h1></div>
  <div style="padding:16px; text-align : center;">
    <h2 style="color:#000;font-size:22px;margin:0px; font-weight :600; line-height : 1; padding-bottom : 16px;">${safeTitle}</h2>
    <p style="color:#444;font-size:16px;margin:0px; padding-bottom : 16px; font-weight :500; line-height : 1;">${safeMessage}</p>
    ${link ? `<a href="${safeLink}" style="background:#201d6a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">Open in ORDR</a>` : ''}
  </div>
  <div style="padding:12px 30px;background:#f8f9fa;text-align:center;font-size:16px;color:#444; font-weight : 500">You can turn these emails off in Settings &rarr; Notifications.</div>
  </div>
  </body>
  </html>`;
}

export const sendNotificationEmail = async (to, title, message, link) => {
  try {
    const transport = await getTransporter();
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || "ORDR <noreply@ordr.app>",
      to,
      subject: `ORDR: ${title}`,
      html: notificationTemplate(title, message, link),
    });
    if (!process.env.SMTP_USER) {
      console.log("Notification email preview:", nodemailer.getTestMessageUrl(info));
    }
    return true;
  } catch (error) {
    console.error("Notification email send error:", error.message);
    return false;
  }
};

// Contact Us form (public website): delivered to the ORDR team inbox, Reply goes to the sender
function contactMessageTemplate({ name, email, company, phone, topic, message }) {
  const row = (label, value) => value
    ? `<tr>
    <td style="padding:4px 0;color:#626884;font-size:14px;text-align:left;width:110px;vertical-align:top; font-weight : 500;">${label}</td>
    <td style="padding:4px 0;color:#000;font-size:16px;font-weight:600;text-align:left;">${escapeHtml(value)}</td>
    </tr>`
    : ''; 
  return `<!DOCTYPE html>
  <html>
  ${EMAIL_HEAD}
  <body style="font-family:${EMAIL_FONT};background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);font-family:${EMAIL_FONT};">
  <div style="background:linear-gradient(135deg,#201d6a,#3d35a0);padding:16px;text-align:center;">
  <h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:2px;">ORDR</h1></div>
  <div style="padding:16px 24px;">
    <h2 style="color:#000;font-size:20px;margin:0 0 12px;font-weight:600;">New message from the website</h2>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #d9d8e6;border-bottom:1px solid #d9d8e6;margin-bottom:16px;">
      ${row('Name', name)}
      ${row('Email', email)}
      ${row('Company', company)}
      ${row('Phone', phone)}
      ${row('Topic', topic)}
    </table> 
    <div style="white-space:pre-line;color:#000;font-size:16px;line-height:1.6;background:#f3f2fa;border-radius:8px;padding:12px 14px; font-weight : 600;">${escapeHtml(message)}</div>
    <p style="color:#626884;font-size:13px;margin:16px 0 0;">Reply to this email to answer ${escapeHtml(name)} directly.</p>
  </div>
  </div>
  </body>
  </html>`;
}

export const sendContactMessageEmail = async (to, details) => {
  try {
    const transport = await getTransporter();
    await transport.sendMail({
      from: process.env.SMTP_FROM || "ORDR <noreply@ordr.app>",
      to,
      replyTo: details.email,
      subject: `ORDR website: ${details.topic || 'New message'} from ${details.name}`,
      html: contactMessageTemplate(details),
    });
    return true;
  } catch (error) {
    console.error("Contact email send error:", error.message);
    return false;
  }
};
