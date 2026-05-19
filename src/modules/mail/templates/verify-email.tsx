import { Text } from '@react-email/components';

import { EmailButton } from '../components/email-button';
import { EmailLayout } from '../components/email-layout';

export interface VerifyEmailProps {
  username: string;
  verificationUrl: string;
}

export default function VerifyEmail({ username, verificationUrl }: VerifyEmailProps) {
  return (
    <EmailLayout preview="Verify your Lorestack email" title="Verify your email">
      <Text style={paragraph}>Hi {username},</Text>
      <Text style={paragraph}>
        Confirm your email address to activate your account and keep it secure.
      </Text>
      <EmailButton href={verificationUrl}>Verify email</EmailButton>
      <Text style={hint}>This link expires in 24 hours.</Text>
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
