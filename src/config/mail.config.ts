export default () => ({
  resendApiKey: process.env.RESEND_API_KEY,
  from: process.env.MAIL_FROM,
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
});
