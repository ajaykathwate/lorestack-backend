import { Text } from '@react-email/components';

export function EmailFooter() {
  return (
    <Text style={footer}>
      This is a transactional email from Lorestack. If you did not request this, you can safely
      ignore it.
    </Text>
  );
}

const footer = {
  margin: 0,
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '18px',
};
