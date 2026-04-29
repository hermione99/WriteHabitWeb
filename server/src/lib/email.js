import { env } from '../config/env.js';

const sanitizeFromAddress = (value) => value
  .trim()
  .replace(/^['"]|['"]$/g, '')
  .replace(/^PASSWORD_RESET_FROM=/, '')
  .trim();

const isValidFromAddress = (value) => {
  const email = '[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+';
  return new RegExp(`^(${email}|[^<>]+ <${email}>)$`).test(value);
};

export const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  if (!env.resendApiKey) {
    return { sent: false, reason: 'missing_resend_api_key' };
  }

  const from = sanitizeFromAddress(env.passwordResetFrom);
  if (!isValidFromAddress(from)) {
    console.error('Invalid PASSWORD_RESET_FROM format. Use no-reply@example.com or WriteHabit <no-reply@example.com>.');
    return { sent: false, reason: 'invalid_from_address' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: 'WriteHabit 비밀번호 재설정',
      html: `
        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #1f1f1f;">
          <h1 style="font-size: 22px;">비밀번호 재설정</h1>
          <p>아래 버튼을 눌러 WriteHabit 비밀번호를 새로 설정해 주세요.</p>
          <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 18px; background: #1f1f1f; color: #ffffff; text-decoration: none;">비밀번호 재설정하기</a></p>
          <p style="font-size: 13px; color: #777;">이 링크는 30분 동안만 유효합니다. 요청한 적이 없다면 이 메일을 무시해도 됩니다.</p>
        </div>
      `,
      text: `WriteHabit 비밀번호 재설정 링크입니다. 30분 안에 접속해 주세요.\n\n${resetUrl}`,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    console.error('Password reset email failed:', data.message || response.statusText);
    return { sent: false, reason: 'email_provider_error' };
  }

  return { sent: true };
};
