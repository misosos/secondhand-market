import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { StorageService } from "../../infra/storage/storage.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { PresignedUploadDto } from "./dto/presigned-upload.dto";
import { ProductListQueryDto } from "./dto/product-list-query.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductService } from "./product.service";

@Controller("products")
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly storageService: StorageService,
  ) {}

  @Public()
  @Get()
  list(@Query() query: ProductListQueryDto) {
    return this.productService.list(query);
  }

  // Declared before ':id' so 'products/mine' resolves here, not as id="mine".
  @Get("mine")
  listMine(@CurrentUser("sub") sellerId: string) {
    return this.productService.listMine(sellerId);
  }

  @Public()
  @Get(":id")
  getDetail(@Param("id") id: string) {
    return this.productService.findDetail(id);
  }

  @Post()
  create(@CurrentUser("sub") sellerId: string, @Body() dto: CreateProductDto) {
    return this.productService.create(sellerId, dto);
  }

  @Patch(":id")
  update(@CurrentUser("sub") sellerId: string, @Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.productService.update(sellerId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser("sub") sellerId: string, @Param("id") id: string) {
    await this.productService.remove(sellerId, id);
  }

  @Post("uploads/presigned")
  presignedUpload(@Body() dto: PresignedUploadDto) {
    return this.storageService.createPresignedUploadUrl(dto.fileName, dto.contentType);
  }
}
