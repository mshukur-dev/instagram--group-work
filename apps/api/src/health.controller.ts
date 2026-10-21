import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Used by Render to check the service is alive. */
  @Public()
  @Get()
  async check(): Promise<{ status: 'ok'; db: 'ok' | 'down' }> {
    const db = await this.prisma.$queryRaw`SELECT 1`.then(
      () => 'ok' as const,
      () => 'down' as const,
    );
    return { status: 'ok', db };
  }
}
