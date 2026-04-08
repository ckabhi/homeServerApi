import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsInt,
  Min,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

class UploadPartDto {
  @IsInt()
  @Min(1)
  partNumber!: number;

  @IsString()
  @IsNotEmpty()
  etag!: string;
}

export class CompleteMultipartUploadDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UploadPartDto)
  parts!: UploadPartDto[];
}
