import { createDecipheriv } from 'node:crypto';
import { CertificateService } from './certificate.service';
import { validateBirthDate } from './ninos.service';

describe('Protección de certificados y fechas', () => {
  const previous = {
    hmac: process.env.CERTIFICATE_HMAC_KEY,
    encryption: process.env.CERTIFICATE_ENCRYPTION_KEY,
    zone: process.env.APP_TIMEZONE,
  };
  beforeEach(() => {
    process.env.CERTIFICATE_HMAC_KEY = '11'.repeat(32);
    process.env.CERTIFICATE_ENCRYPTION_KEY = '22'.repeat(32);
    process.env.APP_TIMEZONE = 'America/Guatemala';
  });
  afterAll(() => {
    for (const [key, value] of Object.entries({
      CERTIFICATE_HMAC_KEY: previous.hmac,
      CERTIFICATE_ENCRYPTION_KEY: previous.encryption,
      APP_TIMEZONE: previous.zone,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  afterEach(() => jest.useRealTimers());

  it('normaliza el HMAC, mantiene el cifrado aleatorio y oculta el número', () => {
    const service = new CertificateService();
    const first = service.protect('ab-1234');
    const second = service.protect(' AB 1234 ');
    expect(first.certificado_hash.equals(second.certificado_hash)).toBe(true);
    expect(first.certificado_cifrado.equals(second.certificado_cifrado)).toBe(
      false,
    );
    expect(first.certificado_ultimos4).toBe('1234');
    expect(first.certificado_cifrado.includes(Buffer.from('ab-1234'))).toBe(
      false,
    );
    expect(first.certificado_hash.length).toBe(32);
  });

  it('permite recuperar el original con su clave y detecta alteraciones', () => {
    const bytes = new CertificateService().protect(
      'ab-1234',
    ).certificado_cifrado;
    const decrypt = (payload: Buffer) => {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        Buffer.from('22'.repeat(32), 'hex'),
        payload.subarray(1, 13),
      );
      decipher.setAAD(Buffer.from('nutritech:certificate:v1'));
      decipher.setAuthTag(payload.subarray(13, 29));
      return Buffer.concat([
        decipher.update(payload.subarray(29)),
        decipher.final(),
      ]).toString();
    };
    expect(bytes[0]).toBe(1);
    expect(decrypt(bytes)).toBe('ab-1234');
    const damaged = Buffer.from(bytes);
    damaged[13] ^= 1;
    expect(() => decrypt(damaged)).toThrow();
  });

  it('rechaza certificados vacíos, insuficientes o con símbolos no admitidos', () => {
    const service = new CertificateService();
    for (const value of ['--- ', '123', 'AB.1234', 'A'.repeat(81)])
      expect(() => service.protect(value)).toThrow();
  });

  it('falla al iniciar si falta una clave válida, sin generar reemplazos', () => {
    delete process.env.CERTIFICATE_HMAC_KEY;
    expect(() => new CertificateService()).toThrow('CERTIFICATE_HMAC_KEY');
  });

  it('valida el calendario y respeta el día local de Guatemala', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-09T04:00:00Z'));
    expect(validateBirthDate('2024-02-29').toISOString()).toBe(
      '2024-02-29T00:00:00.000Z',
    );
    expect(validateBirthDate('2026-09-08')).toBeInstanceOf(Date);
    for (const date of [
      '2025-02-29',
      '2026-09-09',
      '2025-13-01',
      '2025-01-00',
      '0999-01-01',
    ])
      expect(() => validateBirthDate(date)).toThrow();
  });
});
