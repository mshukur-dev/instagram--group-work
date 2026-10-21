import { RealtimeService } from './realtime.service';

describe('RealtimeService presence', () => {
  it('tracks online state across several tabs', () => {
    const rt = new RealtimeService();
    expect(rt.addSocket('u1', 's1')).toBe(true);
    expect(rt.addSocket('u1', 's2')).toBe(false);
    expect(rt.isOnline('u1')).toBe(true);
    expect(rt.removeSocket('u1', 's1')).toBe(false);
    expect(rt.removeSocket('u1', 's2')).toBe(true);
    expect(rt.isOnline('u1')).toBe(false);
  });

  it('is focused while at least one tab is focused', () => {
    const rt = new RealtimeService();
    rt.addSocket('u1', 's1');
    rt.addSocket('u1', 's2');
    rt.setFocus('u1', 's1', false);
    expect(rt.isFocused('u1')).toBe(true);
    rt.setFocus('u1', 's2', false);
    expect(rt.isFocused('u1')).toBe(false);
  });
});
