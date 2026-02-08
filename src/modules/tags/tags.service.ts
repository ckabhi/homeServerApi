import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  async findAll(search?: string) {
    return this.prisma.tag.findMany({
      where: search
        ? {
            name: {
              contains: search,
              // mode: 'insensitive' // MySQL defaults to CI usually, specific collation might vary.
            },
          }
        : undefined,
      select: {
        name: true,
      },
      take: 20, // Limit results
    }).then(tags => tags.map(tag => tag.name));
  }

  async create(name: string) {
    const tag = await this.prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    return tag.name;
  }
}
