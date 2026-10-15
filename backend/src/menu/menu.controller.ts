import { Controller, Get, Header, Req } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.types';
import { MenuService } from './menu.service';

@Controller('menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  getMenu(@Req() request: AuthRequest) {
    // El usuario proviene del JWT validado: nunca de un query parameter.
    return this.menu.forUser(request.principal.usuarioId);
  }
}
