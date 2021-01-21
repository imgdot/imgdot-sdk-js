import { ImgDot } from "../src/imgdot";

describe("imgdot client", () => {
  test("init client", async () => {
    const imgDotClient = new ImgDot("e0b1c283-8a69-4d26-b2c6-ead55c351fe2", {
      apiId: "",
      apiKey: "",
    });
    await imgDotClient.init();
    console.log("init client");
  });
});
