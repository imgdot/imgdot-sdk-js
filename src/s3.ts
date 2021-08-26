import * as aws from "aws-sdk";

const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const S3_REGION = process.env.S3_REGION;
const S3_ENDPOINT = process.env.S3_ENDPOINT;

const getS3Client = () => {
  return new aws.S3({
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    sslEnabled: false,
  });
};

export const s3ReadFile = (key: string) => {
  return getS3Client()
    .getObject({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    })
    .promise();
};

export const s3WriteFile = (key: string, fileContent: string | Buffer | Uint8Array | Blob) => {
  return getS3Client()
    .upload({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: fileContent,
    })
    .promise();
};

export const s3DeleteFile = (key: string) => {
  return getS3Client()
    .deleteObject({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    })
    .promise();
};

export const s3FileExist = (key: string) => {
  return new Promise((resolve, reject) => {
    getS3Client().headObject(
      {
        Bucket: process.env.S3_BUCKET!,
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
};

export const s3ListAllFiles = async (dir: string, recursive?: boolean) => {
  let continuationToken;
  let files: any[] = [];
  let res;
  while (true) {
    res = await s3listFiles(dir, recursive, continuationToken);

    if (res.Contents) {
      files = [...files, ...res.Contents];
    }
    if (!res.IsTruncated) {
      break;
    }
    continuationToken = res.NextContinuationToken;
  }
  return files;
};

const s3listFiles = (dir: string, recursive?: boolean, continuationToken?: string) => {
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
  return getS3Client().listObjectsV2(s3params).promise();
};
