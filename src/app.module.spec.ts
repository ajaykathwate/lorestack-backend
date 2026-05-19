import { Test } from '@nestjs/testing';

describe('AppModule', () => {
  it('compiles', async () => {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/lorestack';
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    const { AppModule } = await import('./app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef).toBeDefined();
  });
});
