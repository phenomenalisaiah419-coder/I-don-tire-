import { compileCriticalAnswers } from './protocol';

const result = compileCriticalAnswers({
  duration: '60 seconds',
  'visual-style': 'Cinematic',
});
if (result.targetDurationMs !== 60000) throw new Error('duration mapping failed');
if (result.style !== 'cinematic') throw new Error('style mapping failed');
