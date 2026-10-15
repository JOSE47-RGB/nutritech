import { classificationProposal } from '../nutrition/classification-draft';
import { Controller, Get, Header } from '@nestjs/common';
import { RequirePermissions } from '../permissions/require-permissions.decorator';
import { PatronesService } from './patrones.service';
@Controller('patrones')
export class PatronesController {
  constructor(private readonly service: PatronesService) {}
  @Get('propuesta-clasificacion')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('patrones.gestionar')
  proposal() {
    return classificationProposal();
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('patrones.gestionar')
  list() {
    return this.service.list();
  }
}
