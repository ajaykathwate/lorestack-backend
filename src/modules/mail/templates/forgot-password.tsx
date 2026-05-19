import { Text } from '@react-email/components';

import { EmailButton } from '../components/email-button';
import { EmailLayout } from '../components/email-layout';

export interface ForgotPasswordEmailProps {
  username: string;
  resetUrl: string;
}

export default function ForgotPasswordEmail({ username, resetUrl }: ForgotPasswordEmailProps) {
  return (
    <EmailLayout preview="Reset your Lorestack password" title="Reset your password">
      <Text style={paragraph}>Hi {username},</Text>
      <Text style={paragraph}>
        We received a request to reset your password. Use the button below to choose a new password.
      </Text>
      <EmailButton href={resetUrl}>Reset password</EmailButton>
      <Text style={hint}>This link expires in 30 minutes.</Text>
    </EmailLayout>
  );
}

const paragraph = {
  margin: '0 0 16px',
};

const hint = {
  margin: '16px 0 0',
  color: '#6b7280',
  fontSize: '13px',
};
