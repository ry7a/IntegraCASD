import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import { AppService } from './app.service.js';

@Controller()
@ApiCookieAuth('cookie')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
