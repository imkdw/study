/**
 * Named Export : 중괄호 내부에서만 로딩 가능
 * Default Export : 괄호 불필요
 */
import initializeLogger, { printMesage, version } from "./app";

initializeLogger();
printMesage(`ESM v${version}`);
