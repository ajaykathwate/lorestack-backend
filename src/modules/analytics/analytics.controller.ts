import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Request } from 'express';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { JwtUser } from '@modules/auth/types/jwt-user.type';

import { AnalyticsService } from './analytics.service';

class RecordViewDto {
  @IsOptional() @IsString() @MaxLength(64) sessionId?: string;
  @IsOptional() @IsString() @MaxLength(50) source?: string;
  @IsOptional() @IsString() @MaxLength(500) referrer?: string;
  @IsOptional() @IsString() @MaxLength(20) device?: string;
}

@ApiTags('analytics')
@Controller({ version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('blogs/:slug/view')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Records a blog view. Optionally pass sessionId, source, referrer, device.' })
  recordView(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Body() dto: RecordViewDto,
  ) {
    const user = (req as any).user as JwtUser | undefined;
    return this.analyticsService.recordBlogView(slug, req, { ...dto, viewerId: user?.sub });
  }

  @Get('blogs/:slug/analytics')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Returns view analytics for a blog. Author only.' })
  getBlogAnalytics(@Param('slug') slug: string, @CurrentUser() user: JwtUser) {
    return this.analyticsService.getBlogAnalytics(slug, user.sub);
  }

  @Get('companies/:handle/analytics')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Returns analytics for a company. Owner only.' })
  getCompanyAnalytics(@Param('handle') handle: string, @CurrentUser() user: JwtUser) {
    return this.analyticsService.getCompanyAnalytics(handle, user.sub);
  }
}
