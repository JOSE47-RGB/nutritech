export interface Profile {
  codigo_publico: string
  codigo_acceso: string
  nombres: string
  apellidos: string
  roles: { codigo: string; nombre: string }[]
  permisos: string[]
  expira_en: string
}

export interface MenuOption {
  id: string
  codigo: string
  nombre: string
  tipo: 'ENLACE' | 'GRUPO' | 'SEPARADOR'
  ruta: string | null
  icono: string | null
  abre_nueva_pestana: boolean
  hijos: MenuOption[]
}

export interface MenuModule {
  id: number
  codigo: string
  nombre: string
  opciones: MenuOption[]
}
