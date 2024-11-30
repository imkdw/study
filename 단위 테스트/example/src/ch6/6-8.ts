import fs from "fs/promises";
import path from "path";

class AuditManager {
  private readonly maxEntriesPerFile: number;
  private readonly directoryName: string;

  constructor(maxEntriesPerFile: number, directoryName: string) {
    this.maxEntriesPerFile = maxEntriesPerFile;
    this.directoryName = directoryName;
  }

  async addRecord(visitorName: string, timeOfVisit: Date): Promise<void> {
    const filePaths = await fs.readdir(this.directoryName);
    const sorted = this.sortByIndex(filePaths);

    const newRecord = `${visitorName};${timeOfVisit.toISOString()}`;

    if (sorted.length === 0) {
      const newFile = path.join(this.directoryName, "audit_1.txt");
      await fs.writeFile(newFile, newRecord);
      return;
    }

    const lastEntry = sorted[sorted.length - 1];
    const currentFileIndex = lastEntry.index;
    const currentFilePath = lastEntry.path;

    const content = await fs.readFile(
      path.join(this.directoryName, currentFilePath),
      "utf8"
    );
    const lines = content.split("\r\n");

    if (lines.length < this.maxEntriesPerFile) {
      lines.push(newRecord);
      const newContent = lines.join("\r\n");
      await fs.writeFile(
        path.join(this.directoryName, currentFilePath),
        newContent
      );
    } else {
      const newIndex = currentFileIndex + 1;
      const newName = `audit_${newIndex}.txt`;
      const newFile = path.join(this.directoryName, newName);
      await fs.writeFile(newFile, newRecord);
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
    // File name example: audit_1.txt
    const fileName = path.parse(filePath).name; // Gets filename without extension
    return parseInt(fileName.split("_")[1]);
  }
}

// Example usage
async function example() {
  const auditManager = new AuditManager(100, "./audit-logs");
  await auditManager.addRecord("John Doe", new Date());
}
