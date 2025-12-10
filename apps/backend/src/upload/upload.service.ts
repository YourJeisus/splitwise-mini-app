import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import * as sharp from "sharp";

@Injectable()
export class UploadService {
  private s3Client: S3Client;
  private bucket: string;
  private cdnUrl: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get<string>("S3_BUCKET") || "";
    this.cdnUrl = this.configService.get<string>("S3_CDN_URL") || "";

    if (!this.bucket || !this.cdnUrl) {
      throw new Error(
        "S3_BUCKET and S3_CDN_URL environment variables are required"
      );
    }

    this.s3Client = new S3Client({
      region: this.configService.get<string>("S3_REGION") || "auto",
      endpoint: this.configService.get<string>("S3_ENDPOINT"),
      credentials: {
        accessKeyId: this.configService.get<string>("S3_ACCESS_KEY_ID") || "",
        secretAccessKey:
          this.configService.get<string>("S3_SECRET_ACCESS_KEY") || "",
      },
    });
  }

  async uploadGroupImage(
    file: Express.Multer.File,
    groupId: string
  ): Promise<string> {
    const compressedBuffer = await sharp(file.buffer)
      .resize(400, 400, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();

    const key = `Popolam/PopolamAppGroups/${groupId}.webp`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: compressedBuffer,
        ContentType: "image/webp",
      })
    );

    return `${this.cdnUrl}/${key}`;
  }

  async deleteGroupImage(groupId: string): Promise<void> {
    const key = `Popolam/PopolamAppGroups/${groupId}.webp`;
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }
}
