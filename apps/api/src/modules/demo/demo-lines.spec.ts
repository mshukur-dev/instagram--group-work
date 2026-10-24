import { replyTo } from './demo-lines';

describe('replyTo', () => {
  it('answers "how are you" even after a greeting', () => {
    for (let i = 0; i < 20; i++) {
      expect(replyTo('Hey! How are you?')).toMatch(/good|Great/i);
    }
  });

  it('answers in the language of the message', () => {
    for (let i = 0; i < 20; i++) {
      expect(replyTo('Привет! Как дела?')).toMatch(/[а-яё]/i);
      expect(replyTo('see you tomorrow')).not.toMatch(/[а-яё]/i);
    }
  });

  it('always has something to say', () => {
    expect(replyTo('')).toEqual(expect.any(String));
    expect(replyTo(null).length).toBeGreaterThan(0);
  });
});
