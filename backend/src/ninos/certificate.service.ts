import { BadRequestException, Injectable } from '@nestjs/common';
import { createCipheriv, createHmac, randomBytes } from 'node:crypto';

function key(name: string): Buffer {
  const value = process.env[name];
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(
      `Configura ${name} con 32 bytes aleatorios en hexadecimal y conserva la clave.`,
    );
  }
  return Buffer.from(value, 'hex');
}

@Injectable()
export class CertificateService {
  private readonly hmacKey = key('CERTIFICATE_HMAC_KEY');
  private readonly encryptionKey = key('CERTIFICATE_ENCRYPTION_KEY');

  guardianDpi(original: string) {
    const normalized = original.replace(/[\s-]/g, '');
    if (!/^\d{13}$/.test(normalized))
      throw new BadRequestException('El DPI debe tener 13 dígitos.');
    return {
      dpi_hash: createHmac('sha256', this.hmacKey)
        .update('nutritech:guardian-dpi:v1:' + normalized)
        .digest(),
      dpi_ultimos4: normalized.slice(-4),
    };
  }
  protect(original: string) {
    const normalized = original.replace(/[\s-]/g, '').toUpperCase();
    if (!/^[A-Z0-9]{4,80}$/.test(normalized)) {
      throw new BadRequestException(
        'El certificado debe contener entre 4 y 80 letras o números, sin contar espacios y guiones.',
      );
    }
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, nonce);
    cipher.setAAD(Buffer.from('nutritech:certificate:v1'));
    const encrypted = Buffer.concat([
      cipher.update(original.trim(), 'utf8'),
      cipher.final(),
    ]);
    return {
      certificado_hash: createHmac('sha256', this.hmacKey)
        .update(normalized)
        .digest(),
      // Formato v1: versión (1 byte), nonce (12), etiqueta GCM (16), contenido.
      certificado_cifrado: Buffer.concat([
        Buffer.from([1]),
        nonce,
        cipher.getAuthTag(),
        encrypted,
      ]),
      certificado_ultimos4: normalized.slice(-4),
    };
  }
}
