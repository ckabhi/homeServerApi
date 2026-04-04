import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class GenerateDownloadUrlDto {
  @IsString()
  @IsNotEmpty()
  objectKey: string;

  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(604800)
  expiresIn?: number;
}
