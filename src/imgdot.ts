import * as aws from "aws-sdk";
import fetch from "node-fetch";
import { Base64 } from "js-base64";

const API_URL = "https://api.imgdot.dev";

interface ApiKeyCredential {
  apiId: string;
  apiKey: string;
}

export class ImgDot {
  s3Client?: aws.S3;
  s3Bucket?: string;
  private podId: string;
  private credential: ApiKeyCredential;

  constructor(podId: string, credential: ApiKeyCredential) {
    this.podId = podId;
    this.credential = credential;
  }

  async init() {
    const resp = await fetch(`${API_URL}/pod-config/${this.podId}`, {
      method: "GET",
      headers: {
        Authorization: "Basic " + Base64.encode(`${this.credential.apiId}:${this.credential.apiKey}`),
      },
    });
    const jsonResp = await resp.json();
    const s3Config = jsonResp.s3Config;
    console.log(jsonResp);

    this.s3Client = new aws.S3({
      accessKeyId: s3Config.accessKey,
      secretAccessKey: s3Config.secretKey,
      region: s3Config.region,
      endpoint: s3Config.endpoint,
      sslEnabled: s3Config.sslEnabled,
    });
    this.s3Bucket = s3Config.bucket;
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
      Bucket: process.env.S3_BUCKET!,
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
}
