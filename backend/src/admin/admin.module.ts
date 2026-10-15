import {
  Body,
  Controller,
  Get,
  Header,
  Module,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RequirePermissions } from '../permissions/require-permissions.decorator';
import type { AuthRequest } from '../auth/auth.types';
import { AdminService } from './admin.service';
import {
  EditRole,
  RoleCode,
  CreateUser,
  EditMenu,
  EditUser,
  MenuCode,
  PageQuery,
  PasswordBody,
  UserCode,
} from './admin.dto';
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}
  @Get('roles')
  @RequirePermissions('roles.gestionar')
  @Header('Cache-Control', 'no-store')
  roleCatalog() {
    return this.service.roleCatalog();
  }
  @Post('roles/:codigo')
  @RequirePermissions('roles.gestionar')
  editRole(
    @Param() p: RoleCode,
    @Body() dto: EditRole,
    @Req() req: AuthRequest,
  ) {
    return this.service.editRole(p.codigo, dto, req.principal.usuarioId);
  }
  @Get('usuarios')
  @RequirePermissions('usuarios.ver')
  @Header('Cache-Control', 'no-store')
  users(@Query() query: PageQuery) {
    return this.service.users(query);
  }
  @Post('usuarios')
  @RequirePermissions('usuarios.ver', 'usuarios.gestionar', 'roles.gestionar')
  create(@Body() dto: CreateUser, @Req() req: AuthRequest) {
    return this.service.create(dto, req.principal.usuarioId);
  }
  @Post('usuarios/:codigo')
  @RequirePermissions('usuarios.ver', 'usuarios.gestionar', 'roles.gestionar')
  edit(@Param() p: UserCode, @Body() dto: EditUser, @Req() req: AuthRequest) {
    return this.service.edit(p.codigo, dto, req.principal.usuarioId);
  }
  @Post('usuarios/:codigo/contrasena')
  @RequirePermissions('usuarios.ver', 'usuarios.gestionar', 'roles.gestionar')
  reset(
    @Param() p: UserCode,
    @Body() dto: PasswordBody,
    @Req() req: AuthRequest,
  ) {
    return this.service.reset(
      p.codigo,
      dto.contrasena,
      req.principal.usuarioId,
    );
  }
  @Get('auditoria')
  @RequirePermissions('auditoria.ver')
  @Header('Cache-Control', 'no-store')
  audit(@Query() q: PageQuery) {
    return this.service.audit(q);
  }
  @Get('menus')
  @RequirePermissions('menus.ver')
  @Header('Cache-Control', 'no-store')
  menus() {
    return this.service.menus();
  }
  @Post('menus/:codigo')
  @RequirePermissions('menus.ver', 'menus.gestionar')
  editMenu(
    @Param() p: MenuCode,
    @Body() dto: EditMenu,
    @Req() req: AuthRequest,
  ) {
    return this.service.editMenu(p.codigo, dto, req.principal.usuarioId);
  }
}
@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
