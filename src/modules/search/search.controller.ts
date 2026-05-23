import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

import { Public } from '@common/decorators/public.decorator';

import { SearchService, SearchType } from './search.service';

class SearchQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;

  @IsOptional()
  @IsEnum(['all', 'articles', 'authors', 'companies'])
  type: SearchType = 'all';
}

@ApiTags('search')
@Public()
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results per type (default 10, max 50)' })
  @ApiQuery({ name: 'type', required: false, enum: ['all', 'articles', 'authors', 'companies'], description: 'Filter results to a specific type (default: all)' })
  @ApiOkResponse({ description: 'Returns matching articles, companies, and/or authors depending on type param.' })
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query.q, query.limit, query.type);
  }
}
