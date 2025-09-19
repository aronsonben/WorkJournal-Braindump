import { parseBraindump, detectDuplicates } from '../lib/braindump-utils';

describe('parseBraindump', () => {
  it('splits and trims lines', () => {
    const input = 'Task A\n\n  Task B  \nTask C';
    expect(parseBraindump(input)).toEqual(['Task A','Task B','Task C']);
  });
});

describe('detectDuplicates', () => {
  it('detects similar lines', () => {
    const lines = ['Fix login bug', 'fix the login bug', 'Write docs'];
    const dupes = detectDuplicates(lines, 0.5);
    expect(dupes.length).toBeGreaterThan(0);
  });
});
