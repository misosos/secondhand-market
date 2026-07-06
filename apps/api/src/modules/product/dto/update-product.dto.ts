import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUrl, Length, Max, Min } from "class-validator";
import { MAX_IMAGES_PER_PRODUCT, MAX_PRICE_WON } from "../product.constants";

const URL_OPTIONS = { require_tld: false, protocols: ["http", "https"], require_protocol: true };

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 5000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_WON)
  price?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_IMAGES_PER_PRODUCT)
  @IsUrl(URL_OPTIONS, { each: true })
  imageUrls?: string[];
}
