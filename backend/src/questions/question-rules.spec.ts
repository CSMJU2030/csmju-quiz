import { questionIssues } from './question-rules';

const mc = (over: Partial<Parameters<typeof questionIssues>[0]> = {}) => ({
  type: 'MULTIPLE_CHOICE',
  prompt: '2 + 2 = ?',
  options: [
    { text: '3', isCorrect: false },
    { text: '4', isCorrect: true },
  ],
  ...over,
});

describe('questionIssues (ตรงกับ frontend question-model)', () => {
  it('คำถามครบ → ไม่มีปัญหา', () => expect(questionIssues(mc())).toEqual([]));
  it('ตรวจโจทย์ว่าง ตัวเลือกซ้ำ และไม่มีคำตอบถูก', () => {
    expect(questionIssues(mc({ prompt: ' ' }))).toContain('prompt is required');
    expect(
      questionIssues(
        mc({
          options: [
            { text: 'a', isCorrect: true },
            { text: 'A', isCorrect: false },
          ],
        }),
      ),
    ).toContain('options must not repeat');
    expect(
      questionIssues(
        mc({
          options: [
            { text: 'a', isCorrect: false },
            { text: 'b', isCorrect: false },
          ],
        }),
      ),
    ).toContain('exactly one option must be correct');
  });
  it('รูปต้องเป็น https และประเภทต้องรองรับ', () => {
    expect(questionIssues(mc({ imageUrl: 'http://x/y.png' }))).toContain(
      'imageUrl must start with https://',
    );
    expect(questionIssues(mc({ type: 'POLL' }))).toContain('type is not supported');
  });
});
