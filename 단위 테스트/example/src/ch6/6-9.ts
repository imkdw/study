import path from "path";

export interface IFileSystem {
  getFiles(directory: string): Promise<string[]>;
  writeAllText(filePath: string, content: string): Promise<void>;
  readAllLines(filePath: string): Promise<string[]>;
}

export class AuditManager {
  private readonly maxEntriesPerFile: number;
  private readonly directoryName: string;
  private readonly fileSystem: IFileSystem;

  constructor(
    maxEntriesPerFile: number,
    directoryName: string,
    fileSystem: IFileSystem
  ) {
    this.maxEntriesPerFile = maxEntriesPerFile;
    this.directoryName = directoryName;
    this.fileSystem = fileSystem;
  }

  async addRecord(visitorName: string, timeOfVisit: Date): Promise<void> {
    const filePaths = await this.fileSystem.getFiles(this.directoryName);
    const sorted = this.sortByIndex(filePaths);

    const newRecord = `${visitorName};${timeOfVisit.toISOString()}`;

    if (sorted.length === 0) {
      const newFile = path.join(this.directoryName, "audit_1.txt");
      await this.fileSystem.writeAllText(newFile, newRecord);
      return;
    }

    const lastEntry = sorted[sorted.length - 1];
    const currentFileIndex = lastEntry.index;
    const currentFilePath = lastEntry.path;

    const lines = await this.fileSystem.readAllLines(
      path.join(this.directoryName, currentFilePath)
    );

    if (lines.length < this.maxEntriesPerFile) {
      lines.push(newRecord);
      const newContent = lines.join("\r\n");
      await this.fileSystem.writeAllText(
        path.join(this.directoryName, currentFilePath),
        newContent
      );
    } else {
      const newIndex = currentFileIndex + 1;
      const newName = `audit_${newIndex}.txt`;
      const newFile = path.join(this.directoryName, newName);
      await this.fileSystem.writeAllText(newFile, newRecord);
    }
  }

  private sortByIndex(files: string[]): Array<{ index: number; path: string }> {
    return files
      .map((path) => ({
        index: this.getIndex(path),
        path: path,
      }))
      .sort((a, b) => a.index - b.index);
  }

  private getIndex(filePath: string): number {
    const path = require("path");
    const fileName = path.parse(filePath).name;
    return parseInt(fileName.split("_")[1]);
  }
}
