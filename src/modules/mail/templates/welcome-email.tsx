import { Text } from '@react-email/components';

import { EmailLayout } from '../components/email-layout';

export interface WelcomeEmailProps {
  username: string;
}

export default function WelcomeEmail({ username }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Welcome to Lorestack" title="Welcome to Lorestack">
      <Text style={paragraph}>Hi {username},</Text>
      <Text style={paragraph}>
        Your account has been created successfully. You can now sign in and start using Lorestack.
      </Text>
    </EmailLayout>
  );
}

const paragraph = {
  margin: '0 0 16px',
};
