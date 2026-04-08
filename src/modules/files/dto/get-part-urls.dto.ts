import { IsArray, ArrayMinSize, IsInt, Min } from 'class-validator';

export class GetPartUrlsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  partNumbers!: number[];
}
