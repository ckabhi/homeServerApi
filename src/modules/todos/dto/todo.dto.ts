import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsArray, IsISO8601 } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTodoDto {
  @ApiProperty({ example: 'My Todo' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: 'Description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'new', enum: ['new', 'active', 'completed', 'blocked', 'backlog'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsISO8601()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsISO8601()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ example: 'bg-blue-500' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ example: ['Work', 'Urgent'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isImportant?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;
}

export class UpdateTodoDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  completed?: boolean; // Keep for backward compatibility if needed, or map to status

  @ApiPropertyOptional()
  @IsISO8601()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsISO8601()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isImportant?: boolean;
}

export class ReorderTodoItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty()
  @IsNotEmpty()
  order!: number;
}

export class ReorderTodoDto {
  @ApiPropertyOptional({ type: [ReorderTodoItemDto] })
  @IsArray()
  @IsOptional()
  items?: ReorderTodoItemDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  order?: string[];
}

export class BulkDeleteDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  ids!: string[];
}

export class BulkCompleteDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  ids!: string[];
}
