import { assert } from "console";
import { ImgDot } from "../src/imgdot";

const imgDotClient = new ImgDot("e0b1c283-8a69-4d26-b2c6-ead55c351fe2", {
  apiId: "94171b54-e632-446a-bdff-c96e60252600",
  apiKey: "test",
});

describe("imgdot client", () => {
  test("init client", async () => {
    await imgDotClient.init();
    console.log("init client");
  });

  test("write file", async () => {
    await imgDotClient.init();
    const resp = await imgDotClient.writeFile("file1", "test");

    const exist = await imgDotClient.fileExistence("file1");
    expect(exist).toBe(true);
  });

  test("read file", async () => {
    await imgDotClient.init();
    const resp = await imgDotClient.readFile("file1");
    // console.log("read file", resp.Body);

    const content = resp.Body?.toString();
    expect(content).toBe("test");
  });

  test("delete file", async () => {
    await imgDotClient.init();
    const resp = await imgDotClient.deleteFile("file1");
    console.log("delete file", resp);

    const exist = await imgDotClient.fileExistence("file1");
    expect(exist).toBe(false);
  });
});
