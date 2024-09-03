import { promises as fs } from "fs";
import ini from "ini";

interface FormatStrategy {
  deserialize: (data: any) => any;
  serialize: (data: any) => any;
}

class Config {
  data: any;
  private formatStrategy: FormatStrategy;

  constructor(formatStrategy: FormatStrategy) {
    this.data = {};
    this.formatStrategy = formatStrategy;
  }

  async load(filePath: string) {
    const file = await fs.readFile(filePath, "utf-8");
    this.data = this.formatStrategy.deserialize(file);
  }

  async save(filePath: string) {
    const file = this.formatStrategy.serialize(this.data);
    await fs.writeFile(filePath, file, "utf-8");
  }
}

const iniStrategy = {
  deserialize: (data: any) => ini.parse(data),
  serialize: (data: any) => ini.stringify(data),
};

const jsonStrategy = {
  deserialize: (data: any) => JSON.parse(data),
  serialize: (data: any) => JSON.stringify(data),
};

const main = async () => {
  const jsonConfig = new Config(jsonStrategy);
  await jsonConfig.load("static/config.json");
  await jsonConfig.save("static/config.json");
  console.log(jsonConfig.data);

  const iniConfig = new Config(iniStrategy);
  await iniConfig.load("static/config.ini");
  await iniConfig.save("static/config.ini");
  console.log(iniConfig.data);
};

main();
