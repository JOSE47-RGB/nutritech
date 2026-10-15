import { EditNinoDto } from './edit-nino.dto';
import { GuardiansService } from './guardians.service';
import {
  PublicCodeDto,
  GuardianCodeDto,
  GuardianSearchDto,
  LinkGuardianDto,
} from './guardian.dto';
import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Param,
  HttpCode,
  Query,
  Req,
} from '@nestjs/common';
import { RequirePermissions } from '../permissions/require-permissions.decorator';
import type { AuthRequest } from '../auth/auth.types';
import { CreateNinoDto } from './create-nino.dto';
import { ListNinosDto } from './list-ninos.dto';
import { NinosService } from './ninos.service';

@Controller('ninos')
export class NinosController {
  constructor(
    private readonly ninos: NinosService,
    private readonly guardians: GuardiansService,
  ) {}

  @Get()
  @RequirePermissions('ninos.ver')
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListNinosDto) {
    return this.ninos.list(query);
  }

  @Get('comunidades')
  @RequirePermissions('ninos.crear')
  @Header('Cache-Control', 'no-store')
  communities() {
    return this.ninos.communities();
  }

  @Post()
  @RequirePermissions('ninos.crear')
  @Header('Cache-Control', 'no-store')
  create(@Body() dto: CreateNinoDto, @Req() req: AuthRequest) {
    return this.ninos.create(dto, req.principal.usuarioId);
  }
  @Post('responsables/buscar')
  @RequirePermissions('ninos.editar')
  @Header('Cache-Control', 'no-store')
  searchGuardiansPrivate(@Body() query: GuardianSearchDto) {
    return this.guardians.search(query.busqueda);
  }

  @Get('responsables/buscar')
  @RequirePermissions('ninos.editar')
  @Header('Cache-Control', 'no-store')
  searchGuardians(@Query() query: GuardianSearchDto) {
    return this.guardians.search(query.busqueda);
  }

  @Get(':codigo')
  @RequirePermissions('ninos.ver')
  @Header('Cache-Control', 'no-store')
  detail(@Param() params: PublicCodeDto) {
    return this.ninos.detail(params.codigo);
  }

  @Post(':codigo/editar')
  @RequirePermissions('ninos.ver', 'ninos.editar')
  @Header('Cache-Control', 'no-store')
  edit(
    @Param() params: PublicCodeDto,
    @Body() dto: EditNinoDto,
    @Req() req: AuthRequest,
  ) {
    return this.ninos.edit(params.codigo, dto, req.principal.usuarioId);
  }

  @Post(':codigo/responsables')
  @RequirePermissions('ninos.editar')
  @Header('Cache-Control', 'no-store')
  link(
    @Param() params: PublicCodeDto,
    @Body() dto: LinkGuardianDto,
    @Req() req: AuthRequest,
  ) {
    return this.guardians.link(params.codigo, dto, req.principal.usuarioId);
  }

  @Post(':codigo/responsables/:responsable/principal')
  @HttpCode(200)
  @RequirePermissions('ninos.editar')
  @Header('Cache-Control', 'no-store')
  primary(@Param() params: GuardianCodeDto, @Req() req: AuthRequest) {
    return this.guardians.makePrimary(
      params.codigo,
      params.responsable,
      req.principal.usuarioId,
    );
  }
}
