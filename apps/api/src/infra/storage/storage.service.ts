import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import type { PresignedUploadResponse } from "@secondhand/types";

// Product photos only for this MVP, so the upload surface is limited to a
// fixed image whitelist instead of accepting arbitrary content types.
const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private readonly presignedUrlExpiresIn: number;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>("S3_BUCKET")!;
    this.region = this.config.get<string>("S3_REGION")!;
    this.endpoint = this.config.get<string>("S3_ENDPOINT") || undefined;
    this.presignedUrlExpiresIn = this.config.get<number>("S3_PRESIGNED_URL_EXPIRES_IN")!;

    this.s3 = new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      // Path-style addressing is required by most S3-compatible endpoints
      // (MinIO, local dev); real AWS S3 also accepts it.
      forcePathStyle: !!this.endpoint,
      credentials: {
        accessKeyId: this.config.get<string>("S3_ACCESS_KEY_ID") ?? "",
        secretAccessKey: this.config.get<string>("S3_SECRET_ACCESS_KEY") ?? "",
      },
    });
  }

  async createPresignedUploadUrl(
    fileName: string,
    contentType: string,
  ): Promise<PresignedUploadResponse> {
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new BadRequestException(`Unsupported content type: ${contentType}`);
    }

    const key = `products/${randomUUID()}-${fileName}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: this.presignedUrlExpiresIn,
    });

    const fileUrl = this.endpoint
      ? `${this.endpoint}/${this.bucket}/${key}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return { uploadUrl, fileUrl };
  }
}
