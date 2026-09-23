import nodemailer from "nodemailer";

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

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
  <head>
  <meta charset="utf-8"></head>
  <body style="font-family:Segoe UI,Tahoma,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
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

function teamInviteTemplate(inviterName, companyName, role, inviteLink) {
  return `<!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="font-family:Segoe UI,Tahoma,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
  <div style="background:linear-gradient(135deg,#201d6a,#3d35a0);padding:15px 30px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:2px;">ORDR</h1></div>
  <div style="padding:15px 30px;text-align:center;">
    <h2 style="color:#000; font-size : 24px; margin : 5px 0">You've been invited!</h2>
    <p style="color:#666; font-size: 16px; margin-top : 10px margin-bottom : 0px"><b>${inviterName}</b> has invited you to join <b>${companyName}</b> as a ${role === 'admin' ? 'an' : 'a'} <b>${role}</b>.</p>
    <div style="margin: 15px 0;">
      <a href="${inviteLink}" style="background:#201d6a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:16px;font-weight:600;display:inline-block;">Accept Invitation</a>
    </div>
    <p style="color:#999;font-size:14px;">If you did not expect this, please ignore this email.</p>
  </div>
  <div style="padding:15px 30px;background:#f8f9fa;text-align:center;font-size:12px;color:#999;"><p>&copy; ${new Date().getFullYear()} ORDR. All rights reserved.</p></div>
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
