import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { ReactNode } from 'react';

import { EmailFooter } from './email-footer';

interface EmailLayoutProps {
  preview: string;
  title: string;
  children: ReactNode;
}

export function EmailLayout({ preview, title, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={brand}>Lorestack</Text>
          <Heading style={heading}>{title}</Heading>
          <Section style={content}>{children}</Section>
          <Hr style={divider} />
          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  margin: 0,
  backgroundColor: '#f6f8fb',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 20px',
  backgroundColor: '#ffffff',
};

const brand = {
  margin: '0 0 24px',
  color: '#111827',
  fontSize: '18px',
  fontWeight: '700',
};

const heading = {
  margin: '0 0 16px',
  color: '#111827',
  fontSize: '24px',
  lineHeight: '32px',
};

const content = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '24px',
};

const divider = {
  borderColor: '#e5e7eb',
  margin: '28px 0',
};
