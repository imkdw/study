class AuditManager {
  private readonly maxEntriesPerFile: number;

  constructor(maxEntriesPerFile: number) {
    this.maxEntriesPerFile = maxEntriesPerFile;
  }

  public addRecord(
    files: FileContent[],
    visitorName: string,
    timeOfVisit: Date
  ): FileUpdate {
    const sorted = this.sortByIndex(files);
    const newRecord = `${visitorName};${timeOfVisit
      .toISOString()
      .slice(0, 19)}`;

    if (sorted.length === 0) {
      return {
        fileName: "audit_1.txt",
        newContent: newRecord,
      };
    }

    const lastEntry = sorted[sorted.length - 1];
    const currentFileIndex = lastEntry.index;
    const currentFile = lastEntry.file;
    const lines = [...currentFile.lines];

    if (lines.length < this.maxEntriesPerFile) {
      lines.push(newRecord);
      const newContent = lines.join("\r\n");
      return {
        fileName: currentFile.fileName,
        newContent: newContent,
      };
    } else {
      const newIndex = currentFileIndex + 1;
      const newName = `audit_${newIndex}.txt`;
      return {
        fileName: newName,
        newContent: newRecord,
      };
    }
  }

  private sortByIndex(
    files: FileContent[]
  ): Array<{ index: number; file: FileContent }> {
    return files
      .map((file) => ({
        index: this.getIndex(file.fileName),
        file: file,
      }))
      .sort((a, b) => a.index - b.index);
  }

  private getIndex(fileName: string): number {
    const name = fileName.replace(".txt", "");
    return parseInt(name.split("_")[1]);
  }
}

// Persister class
class Persister {
  async readDirectory(directoryName: string): Promise<FileContent[]> {
    const files = await this.fs.readdir(directoryName);
    const contents = await Promise.all(
      files.map(async (file: string) => {
        const fullPath = this.path.join(directoryName, file);
        const content = await this.fs.readFile(fullPath, "utf8");
        return {
          fileName: file,
          lines: content
            .split("\r\n")
            .filter((line: string) => line.length > 0),
        };
      })
    );
    return contents;
  }

  async applyUpdate(directoryName: string, update: FileUpdate): Promise<void> {
    const filePath = this.path.join(directoryName, update.fileName);
    await this.fs.writeFile(filePath, update.newContent);
  }
}

// ApplicationService class
class ApplicationService {
  private readonly directoryName: string;
  private readonly auditManager: AuditManager;
  private readonly persister: Persister;

  constructor(directoryName: string, maxEntriesPerFile: number) {
    this.directoryName = directoryName;
    this.auditManager = new AuditManager(maxEntriesPerFile);
    this.persister = new Persister();
  }

  async addRecord(visitorName: string, timeOfVisit: Date): Promise<void> {
    const files = await this.persister.readDirectory(this.directoryName);
    const update = this.auditManager.addRecord(files, visitorName, timeOfVisit);
    await this.persister.applyUpdate(this.directoryName, update);
  }
}

it("creates new file when current file overflows", () => {
  // Arrange
  const sut = new AuditManager(3);
  const files: FileContent[] = [
    {
      fileName: "audit_1.txt",
      lines: [],
    },
    {
      fileName: "audit_2.txt",
      lines: [
        "Peter;2019-04-06T16:30:00",
        "Jane;2019-04-06T16:40:00",
        "Jack;2019-04-06T17:00:00",
      ],
    },
  ];

  // Act
  const update = sut.addRecord(files, "Alice", new Date("2019-04-06T18:00:00"));

  // Assert
  expect(update.fileName).toBe("audit_3.txt");
  expect(update.newContent).toBe("Alice;2019-04-06T18:00:00");
  expect(update).toEqual({
    fileName: "audit_3.txt",
    newContent: "Alice;2019-04-06T18:00:00",
  });
});
