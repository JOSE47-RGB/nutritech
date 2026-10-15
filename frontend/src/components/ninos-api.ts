export interface Nino {
  codigo_publico: string
  codigo_expediente: string
  primer_nombre: string
  segundo_nombre: string | null
  primer_apellido: string
  segundo_apellido: string | null
  fecha_nacimiento: string
  sexo_biologico: 'M' | 'F'
  estado: 'ACTIVO' | 'INACTIVO' | 'ARCHIVADO'
  certificado_ultimos4: string
  comunidad: string | null
}

export interface NinosPage {
  datos: Nino[]
  total: number
  pagina: number
  limite: number
  paginas: number
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) throw new ApiError(401, 'Tu sesión terminó. Ingresa nuevamente.')
    if (response.status === 403) throw new ApiError(403, 'No tienes permiso para esta acción.')
    if (response.status === 404) throw new ApiError(404, 'No se encontró el registro solicitado.')
    if (response.status === 429) throw new ApiError(429, 'Hay demasiadas solicitudes. Espera un momento y vuelve a intentar.')
    if (response.status === 400 || response.status === 409) {
      const body = await response.json() as { message?: string | string[] }
      throw new ApiError(response.status, Array.isArray(body.message) ? body.message.join(' ') : body.message || 'Revisa los datos enviados.')
    }
    throw new ApiError(response.status, 'El servidor no pudo completar la operación. Intenta nuevamente.')
  }
  return response.json() as Promise<T>
}
