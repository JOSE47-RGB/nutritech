import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { Public } from './public.decorator';
import { cookieOptions, SESSION_COOKIE, SESSION_SECONDS } from './auth.config';
import type { AuthRequest } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token } = await this.auth.login(dto, req.get('user-agent'));
    res.cookie(SESSION_COOKIE, token, {
      ...cookieOptions(),
      maxAge: SESSION_SECONDS * 1000,
    });
    return { mensaje: 'Sesión iniciada.' };
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  async me(@Req() req: AuthRequest) {
    return {
      ...(await this.auth.profile(req.principal.usuarioId)),
      expira_en: req.principal.expiraEn,
    };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.principal);
    res.clearCookie(SESSION_COOKIE, cookieOptions());
  }
}
