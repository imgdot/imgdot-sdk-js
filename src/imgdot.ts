import * as aws from "aws-sdk";
import fetch from "node-fetch";
import { Base64 } from "js-base64";
import createHmac from "create-hmac";
import { Mutex } from "async-mutex";

const API_URL = "https://api.imgdot.dev";
// const API_URL = "http://localhost:8080";

interface ApiKeyCredential {
  apiId: string;
  apiKey: string;
}

interface ImgProxyConfig {
  baseUrl: string;
  key: string;
  salt: string;
  quality: number;
}

export class ImgDot {
  private podId: string;
  private credential: ApiKeyCredential;
  s3Client?: aws.S3;
  s3Bucket?: string;
  imgProxyConfig?: ImgProxyConfig;
  initLock: Mutex;

  constructor(podId: string, credential: ApiKeyCredential) {
    this.podId = podId;
    this.credential = credential;
    this.initLock = new Mutex();
  }

  async init(refresh = false) {
    const release = await this.initLock.acquire();
    try {
      if (this.s3Client && !refresh) {
        return;
      }
      const resp = await fetch(`${API_URL}/pod-config/${this.podId}`, {
        method: "GET",
        headers: {
          Authorization: "Basic " + Base64.encode(`${this.credential.apiId}:${this.credential.apiKey}`),
        },
      });
      const jsonResp = await resp.json();
      const s3Config = jsonResp.s3Config;

      this.s3Client = new aws.S3({
        accessKeyId: s3Config.accessKey,
        secretAccessKey: s3Config.secretKey,
        region: s3Config.region,
        endpoint: s3Config.endpoint,
        sslEnabled: s3Config.sslEnabled,
      });
      this.s3Bucket = s3Config.bucket;

      const imgProxyResp = jsonResp.imgProxyConfig;
      this.imgProxyConfig = {
        baseUrl: imgProxyResp.baseUrl,
        key: imgProxyResp.key,
        salt: imgProxyResp.salt,
        quality: imgProxyResp.quality,
      };
      console.log("init:", this);
      return this;
    } finally {
      release();
    }
  }

  async readFile(key: string) {
    return this.s3Client!.getObject({
      Bucket: this.s3Bucket!,
      Key: key,
    }).promise();
  }

  async writeFile(key: string, fileContent: string | Buffer | Uint8Array | Blob) {
    return this.s3Client!.upload({
      Bucket: this.s3Bucket!,
      Key: key,
      Body: fileContent,
    }).promise();
  }

  async deleteFile(key: string) {
    return this.s3Client!.deleteObject({
      Bucket: this.s3Bucket!,
      Key: key,
    }).promise();
  }

  async fileExistence(key: string) {
    return new Promise((resolve, reject) => {
      this.s3Client!.headObject(
        {
          Bucket: this.s3Bucket!,
          Key: key,
        },
        function (err, data) {
          console.log("Check file exist:", key);
          if (err) {
            if (err.code === "NotFound") {
              resolve(false);
            } else {
              console.error("s3 get head err:", key);
              reject(err);
            }
          } else {
            resolve(true);
          }
        },
      );
    });
  }

  async s3ListAllFiles(dir: string, recursive?: boolean) {
    let continuationToken;
    let files: any[] = [];
    let res;
    while (true) {
      res = await this.s3listFiles(dir, recursive, continuationToken);

      if (res.Contents) {
        files = [...files, ...res.Contents];
      }
      if (!res.IsTruncated) {
        break;
      }
      continuationToken = res.NextContinuationToken;
    }
    return files;
  }

  async s3listFiles(dir: string, recursive?: boolean, continuationToken?: string) {
    const s3params = {
      Bucket: this.s3Bucket!,
      MaxKeys: 20,
      Prefix: dir,
      Delimiter: "/",
      ContinuationToken: continuationToken,
    };
    if (recursive) {
      s3params.Delimiter = "";
    }
    return this.s3Client!.listObjectsV2(s3params).promise();
  }

  genImageUrl(imageUrl: string, size: string) {
    if (!imageUrl) {
      return null;
    }
    let width = 0;
    let height = 0;
    let resizing_type = "auto";
    if (size.includes("x")) {
      width = Number(size.split("x")[0]);
      height = Number(size.split("x")[1]);
      resizing_type = "fill";
    }
    if (size.includes("z")) {
      width = Number(size.split("z")[0]);
      height = Number(size.split("z")[1]);
      resizing_type = "fit";
    }
    const gravity = "no";
    const enlarge = 1;
    const extension = "jpg";
    const encoded_url = this.urlSafeBase64(imageUrl);
    const path = `/${resizing_type}/${width}/${height}/${gravity}/${enlarge}/${encoded_url}.${extension}`;

    const signature = this.sign(this.imgProxyConfig!.salt, path, this.imgProxyConfig!.key);

    return `${this.imgProxyConfig?.baseUrl}/${signature}${path}`;
  }

  // generate imgproxy url and sign
  genImageUrls(url: string, sizes: string[]) {
    const result: any = {};
    for (let i = 0; i < sizes.length; i++) {
      const size = sizes[i];

      result[size] = this.genImageUrl(url, size);
    }
    return result;
  }

  private urlSafeBase64(input: Buffer | string) {
    return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }

  private hexDecode(hex: string) {
    return Buffer.from(hex, "hex");
  }

  private sign(salt: string, target: string, secret: string) {
    const hmac = createHmac("sha256", this.hexDecode(secret));
    hmac.update(this.hexDecode(salt));
    hmac.update(target);
    return this.urlSafeBase64(hmac.digest());
  }
}
