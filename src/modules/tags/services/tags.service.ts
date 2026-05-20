import { Injectable, NotFoundException } from '@nestjs/common';

import { mapPrismaError } from '@database/prisma/prisma.exceptions';

import { TagEntity } from '../entities/tag.entity';
import { TagsRepository } from '../repositories/tags.repository';

@Injectable()
export class TagsService {
  constructor(private readonly repo: TagsRepository) {}

  async findAll(): Promise<TagEntity[]> {
    const tags = await this.repo.findAll(true);
    return tags.map((t) => new TagEntity(t));
  }

  async findTrending(limit = 10): Promise<TagEntity[]> {
    const tags = await this.repo.findAll(true);
    return tags.slice(0, limit).map((t) => new TagEntity(t));
  }

  async findBySlug(slug: string): Promise<TagEntity> {
    const tag = await this.repo.findBySlug(slug);
    if (!tag) throw new NotFoundException('Tag not found.');
    return new TagEntity(tag);
  }

  async approve(id: string): Promise<TagEntity> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Tag not found.');
    try {
      const updated = await this.repo.approve(id);
      return new TagEntity(updated);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  /**
   * Resolves a list of tag names to Tag records, creating new (unapproved) tags
   * for names that do not yet exist. Returns the resolved Tag rows.
   * Used internally by BlogsService.
   */
  async resolveOrCreateTags(names: string[]): Promise<TagEntity[]> {
    const resolved: TagEntity[] = [];

    for (const raw of names) {
      const name = raw.trim();
      const slug = this.toSlug(name);

      let tag = await this.repo.findByName(name);
      if (!tag) {
        tag = await this.repo.create(name, slug);
      }
      resolved.push(new TagEntity(tag));
    }

    return resolved;
  }

  toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
