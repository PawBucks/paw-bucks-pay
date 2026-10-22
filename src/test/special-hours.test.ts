import { describe, it, expect } from 'vitest';
import { fitsOpenWindow, specialWindowsForDate, validateOpenWindows, type SpecialHours } from '../lib/specialHours';
import { schedulingService } from '../services/api/scheduling.service';

const windows = [{ start_time: '09:00', end_time: '12:00' }, { start_time: '14:00', end_time: '17:00' }];
const holiday: SpecialHours = { id: 'holiday', special_date: '2026-12-24', label: 'Christmas Eve', is_closed: false, repeat_annually: false, windows };

describe('Holiday booking rules', () => {
  it('blocks all slots on a blackout date even if other entries have open windows', () => {
    expect(specialWindowsForDate([holiday, { ...holiday, id: 'blackout', is_closed: true }], '2026-12-24')).toEqual([]);
  });
  it('supports 9–12 and 2–5 windows but blocks bookings crossing the gap', () => {
    expect(fitsOpenWindow(windows, '11:00', '12:00')).toBe(true);
    expect(fitsOpenWindow(windows, '11:30', '14:30')).toBe(false);
    expect(fitsOpenWindow(windows, '12:00', '13:00')).toBe(false);
    expect(fitsOpenWindow(windows, '14:00', '15:00')).toBe(true);
  });
  it('annual entries repeat on the same month and day, not the next day', () => {
    expect(specialWindowsForDate([{ ...holiday, repeat_annually: true }], '2027-12-24')).toEqual(windows);
    expect(specialWindowsForDate([{ ...holiday, repeat_annually: true }], '2027-12-25')).toBeNull();
  });
  it('one-time entries do not repeat the following year', () => {
    expect(specialWindowsForDate([holiday], '2027-12-24')).toBeNull();
  });
  it('rejects overlapping or reversed open windows', () => {
    expect(validateOpenWindows([{ start_time: '09:00', end_time: '12:00' }, { start_time: '11:00', end_time: '14:00' }])).toBe('Open windows cannot overlap');
    expect(validateOpenWindows([{ start_time: '17:00', end_time: '09:00' }])).toBe('Each open window must end after it starts');
    expect(validateOpenWindows(windows)).toBeNull();
  });
  it('special windows replace weekly hours and produce no lunch-gap slots', () => {
    const weekly = [{ id: 'weekly', merchant_id: 'business', day_of_week: 4, start_time: '08:00', end_time: '20:00', is_active: true, slot_duration_minutes: 60, created_at: '', updated_at: '' }];
    expect(schedulingService.generateTimeSlots(weekly, [], [], new Date(2026, 11, 24), 60, [holiday])).toEqual(['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']);
  });
});