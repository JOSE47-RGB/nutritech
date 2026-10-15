import { evaluationAge } from './evaluaciones.service';
describe('Edad al evaluar, calendario de Guatemala', () => {
  const now = new Date('2026-09-08T18:00:00Z');
  it('usa el día local antes de medianoche UTC', () => {
    expect(
      evaluationAge(
        new Date('2024-09-08'),
        new Date('2024-09-09T05:59:00Z'),
        now,
      ),
    ).toBe(0);
    expect(
      evaluationAge(
        new Date('2024-09-08'),
        new Date('2024-09-09T06:00:00Z'),
        now,
      ),
    ).toBe(1);
  });
  it('rechaza fechas futuras y anteriores al nacimiento', () => {
    expect(() =>
      evaluationAge(
        new Date('2024-09-08'),
        new Date('2024-09-08T05:00:00Z'),
        now,
      ),
    ).toThrow();
    expect(() =>
      evaluationAge(new Date('2024-09-08'), new Date('2027-01-01'), now),
    ).toThrow();
    expect(() =>
      evaluationAge(new Date('2024-09-08'), new Date('invalid'), now),
    ).toThrow();
  });
  it('admite hasta el día anterior al quinto cumpleaños', () => {
    expect(
      evaluationAge(
        new Date('2021-09-08'),
        new Date('2026-09-08T05:59:00Z'),
        now,
      ),
    ).toBe(1825);
    expect(() =>
      evaluationAge(
        new Date('2021-09-08'),
        new Date('2026-09-08T06:00:00Z'),
        now,
      ),
    ).toThrow();
  });
  it('para nacimiento el 29 de febrero aplica el corte el 1 de marzo', () => {
    expect(
      evaluationAge(
        new Date('2020-02-29'),
        new Date('2025-02-28T18:00:00Z'),
        now,
      ),
    ).toBe(1826);
    expect(() =>
      evaluationAge(
        new Date('2020-02-29'),
        new Date('2025-03-01T06:00:00Z'),
        now,
      ),
    ).toThrow();
  });
});
