import { ReactElement } from 'react';

export interface SendTemplateEmailOptions {
  to: string;
  subject: string;
  template: ReactElement;
}
