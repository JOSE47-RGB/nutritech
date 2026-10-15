import type { Request } from 'express';

export interface Principal {
  usuarioId: bigint;
  sesionId: bigint;
  expiraEn: string;
}

export interface AuthRequest extends Request {
  principal: Principal;
}
