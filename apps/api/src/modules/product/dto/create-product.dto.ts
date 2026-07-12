import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, IsUrl, Length, Max, Min } from "class-validator";
import { SanitizeHtml } from "../../../common/decorators/sanitize-html.decorator";
import { MAX_IMAGES_PER_PRODUCT, MAX_PRICE_WON } from "../product.constants";

// require_tld: false so local/dev S3-compatible endpoints (MinIO on
// localhost) validate the same as real S3/CDN URLs.
const URL_OPTIONS = { require_tld: false, protocols: ["http", "https"], require_protocol: true };

export class CreateProductDto {
  @IsString()
  @Length(1, 100)
  @SanitizeHtml()
  name: string;

  @IsString()
  @Length(1, 5000)
  @SanitizeHtml()
  description: string;

  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_WON)
  price: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_IMAGES_PER_PRODUCT)
  @IsUrl(URL_OPTIONS, { each: true })
  imageUrls: string[];
}
